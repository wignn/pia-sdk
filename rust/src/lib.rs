//! Official PIA Rust SDK
use futures_util::{SinkExt, StreamExt};
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION};
use reqwest::{Client, Method, StatusCode};
use serde::de::DeserializeOwned;
use std::env;
use std::fmt;
use std::fmt::Formatter;
use std::sync::{Arc, Mutex};
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::Message;

pub const DEFAULT_BASE_URL: &str = "https://api-engine.wign.dev";
pub const DEFAULT_WS_URL: &str = "wss://api-engine.wign.dev/api/v1/ws";

pub enum PiaError {
    MissingApiKey,
    Network(reqwest::Error),
    WebSocket(tokio_tungstenite::tungstenite::Error),
    Api {
        status: StatusCode,
        message: String,
        request_id: Option<String>,
    },
    Json(serde_json::Error),
    AuthFailed(String),
}

impl fmt::Debug for PiaError {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        match self {
            Self::MissingApiKey => f.write_str("MissingApiKey"),
            Self::Network(_) => f.write_str("Network(<redacted>)"),
            Self::WebSocket(_) => f.write_str("WebSocket(<redacted>)"),
            Self::Api {
                status, request_id, ..
            } => f
                .debug_struct("Api")
                .field("status", status)
                .field("request_id", request_id)
                .finish(),
            Self::Json(_) => f.write_str("Json(<redacted>)"),
            Self::AuthFailed(_) => f.write_str("AuthFailed(<redacted>)"),
        }
    }
}

impl fmt::Display for PiaError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::MissingApiKey => {
                write!(f, "PIA API key not provided and PIA_API_KEY env not set")
            }
            Self::Network(_) => write!(f, "Network error"),
            Self::WebSocket(_) => write!(f, "WebSocket error"),
            Self::Api {
                status, request_id, ..
            } => write!(
                f,
                "API error ({status}){}",
                request_id
                    .as_ref()
                    .map(|id| format!(" (request id: {id})"))
                    .unwrap_or_default()
            ),
            Self::Json(_) => write!(f, "JSON error"),
            Self::AuthFailed(_) => write!(f, "Authentication failed"),
        }
    }
}

impl std::error::Error for PiaError {}

fn redact_server_credentials(message: &str) -> String {
    let mut redacted = String::with_capacity(message.len());
    let mut remaining = message;
    while !remaining.is_empty() {
        let lower = remaining.to_ascii_lowercase();
        let next = [
            lower.find("bearer "),
            lower.find("wi_live_"),
            lower.find("api_key="),
            lower.find("api-key="),
            lower.find("apikey="),
            lower.find("token="),
            lower.find("password="),
            lower.find("secret="),
            lower.find("key="),
        ]
        .into_iter()
        .flatten()
        .min();
        let Some(start) = next else {
            redacted.push_str(remaining);
            break;
        };
        redacted.push_str(&remaining[..start]);
        let tail = &remaining[start..];
        let marker_len = if tail
            .as_bytes()
            .get(..7)
            .is_some_and(|prefix| prefix.eq_ignore_ascii_case(b"bearer "))
        {
            7
        } else if tail
            .as_bytes()
            .get(..8)
            .is_some_and(|prefix| prefix.eq_ignore_ascii_case(b"wi_live_"))
        {
            8
        } else {
            tail.find('=').map(|index| index + 1).unwrap_or(0)
        };
        let marker = &tail[..marker_len];
        let value = &tail[marker_len..];
        let value_len = value
            .find(|ch: char| ch.is_whitespace() || matches!(ch, '&' | '#' | '"' | '\'' | ')' | ']'))
            .unwrap_or(value.len());
        redacted.push_str(marker);
        redacted.push_str("[REDACTED]");
        remaining = &value[value_len..];
    }

    // Remove URL userinfo (including passwords) up to the host separator.
    let mut output = redacted.clone();
    for scheme in ["http://", "https://", "ws://", "wss://"] {
        let mut cursor = 0;
        while cursor < output.len() {
            let lower = output[cursor..].to_ascii_lowercase();
            let Some(relative_start) = lower.find(scheme) else {
                break;
            };
            let authority_start = cursor + relative_start + scheme.len();
            let authority_end = output[authority_start..]
                .find(['/', '?', '#', ' '])
                .map(|index| authority_start + index)
                .unwrap_or(output.len());
            if let Some(at) = output[authority_start..authority_end].rfind('@') {
                let userinfo_end = authority_start + at;
                output.replace_range(authority_start..userinfo_end, "[REDACTED]");
                cursor = authority_start + "[REDACTED]@".len();
            } else {
                cursor = authority_end;
            }
            if cursor >= output.len() {
                break;
            }
        }
    }
    output
}

fn safe_server_message(body: &str) -> String {
    const MAX_MESSAGE_LEN: usize = 256;
    let parsed = serde_json::from_str::<serde_json::Value>(body).ok();
    let message = parsed.as_ref().and_then(|value| {
        value
            .get("message")
            .or_else(|| value.get("error"))
            .and_then(serde_json::Value::as_str)
    });
    let Some(message) = message else {
        return "Server returned an error".into();
    };
    let safe = redact_server_credentials(message)
        .chars()
        .filter(|ch| !ch.is_control())
        .take(MAX_MESSAGE_LEN)
        .collect::<String>();
    if safe.is_empty() {
        "Server returned an error".into()
    } else {
        safe
    }
}

fn validate_request_path(path: &str) -> Result<(), PiaError> {
    if path.starts_with("//") || reqwest::Url::parse(path).is_ok() {
        return Err(PiaError::AuthFailed("Request path must be relative".into()));
    }
    Ok(())
}

impl From<reqwest::Error> for PiaError {
    fn from(e: reqwest::Error) -> Self {
        Self::Network(e)
    }
}

impl From<tokio_tungstenite::tungstenite::Error> for PiaError {
    fn from(e: tokio_tungstenite::tungstenite::Error) -> Self {
        Self::WebSocket(e)
    }
}

impl From<serde_json::Error> for PiaError {
    fn from(e: serde_json::Error) -> Self {
        Self::Json(e)
    }
}

#[derive(Clone)]
pub struct PiaClient {
    base_url: String,
    ws_url: String,
    api_key: String,
    http: Client,
    realtime_timeout: std::time::Duration,
}

impl fmt::Debug for PiaClient {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        f.debug_struct("PiaClient")
            .field("base_url", &"[REDACTED]")
            .field("ws_url", &"[REDACTED]")
            .field("api_key", &"[REDACTED]")
            .finish_non_exhaustive()
    }
}

impl PiaClient {
    pub fn new(api_key: impl Into<String>) -> Result<Self, PiaError> {
        Self::builder().api_key(api_key).build()
    }

    pub fn from_env() -> Result<Self, PiaError> {
        Self::builder().build()
    }

    pub fn builder() -> PiaClientBuilder {
        PiaClientBuilder::default()
    }

    pub fn base_url(&self) -> &str {
        &self.base_url
    }

    pub fn ws_url(&self) -> &str {
        &self.ws_url
    }

    pub fn api_key(&self) -> &str {
        &self.api_key
    }

    // ponytail: generic serde_json::Value response covers all endpoints; upgrade to typed structs when strong domain typing is required.
    pub async fn request<T: DeserializeOwned>(
        &self,
        method: Method,
        path: &str,
        query: Option<&[(&str, &str)]>,
        body: Option<&serde_json::Value>,
    ) -> Result<T, PiaError> {
        validate_request_path(path)?;
        let url = format!(
            "{}/{}",
            self.base_url.trim_end_matches('/'),
            path.trim_start_matches('/')
        );
        let mut req = self.http.request(method, &url);

        if let Some(q) = query {
            req = req.query(q);
        }
        if let Some(b) = body {
            req = req.json(b);
        }

        let res = req.send().await?;
        let status = res.status();
        if !status.is_success() {
            let request_id = res
                .headers()
                .get("x-request-id")
                .or_else(|| res.headers().get("cf-ray"))
                .and_then(|value| value.to_str().ok())
                .map(str::to_owned);
            let body = res.bytes().await.unwrap_or_default();
            let body = String::from_utf8_lossy(&body[..body.len().min(8 * 1024)]);
            let message = safe_server_message(&body);
            return Err(PiaError::Api {
                status,
                message,
                request_id,
            });
        }

        Ok(res.json().await?)
    }

    pub async fn get_prices(&self) -> Result<serde_json::Value, PiaError> {
        self.request(Method::GET, "/api/v1/market/prices", None, None)
            .await
    }

    pub async fn get_price(&self, symbol: &str) -> Result<serde_json::Value, PiaError> {
        let clean = symbol.trim().to_uppercase();
        self.request(
            Method::GET,
            &format!("/api/v1/market/prices/{clean}"),
            None,
            None,
        )
        .await
    }

    pub async fn get_symbols(&self) -> Result<serde_json::Value, PiaError> {
        self.request(Method::GET, "/api/v1/market/symbols", None, None)
            .await
    }

    pub async fn get_candles(
        &self,
        symbol: &str,
        timeframe: &str,
        limit: Option<u32>,
    ) -> Result<serde_json::Value, PiaError> {
        let clean = symbol.trim().to_uppercase();
        let limit_str = limit.map(|l| l.to_string());
        let mut query = vec![("resolution", timeframe)];
        if let Some(ref l) = limit_str {
            query.push(("limit", l.as_str()));
        }
        self.request(
            Method::GET,
            &format!("/api/v1/market/history/{clean}"),
            Some(&query),
            None,
        )
        .await
    }

    pub async fn get_news(&self) -> Result<serde_json::Value, PiaError> {
        self.request(Method::GET, "/api/v1/news", None, None).await
    }

    pub async fn get_fear_greed(&self) -> Result<serde_json::Value, PiaError> {
        self.request(Method::GET, "/api/v1/fear-greed", None, None)
            .await
    }

    /// Connects to the Realtime WebSocket gateway and completes in-band authentication.
    pub async fn connect_realtime(&self) -> Result<PiaRealtimeStream, PiaError> {
        let mut stream = tokio::time::timeout(self.realtime_timeout, self.connect_realtime_inner())
            .await
            .map_err(|_| PiaError::AuthFailed("Realtime authentication timed out".into()))??;
        stream.reconnect = Some(RealtimeReconnect {
            ws_url: self.websocket_url(),
            api_key: self.api_key.clone(),
            timeout: self.realtime_timeout,
            subscriptions: Arc::new(Mutex::new(Vec::new())),
            explicitly_closed: Arc::new(std::sync::atomic::AtomicBool::new(false)),
        });
        Ok(stream)
    }

    fn websocket_url(&self) -> String {
        let mut url = self.ws_url.clone();
        if url.starts_with("http://") {
            url = url.replacen("http://", "ws://", 1);
        } else if url.starts_with("https://") {
            url = url.replacen("https://", "wss://", 1);
        }
        url
    }

    async fn connect_realtime_inner(&self) -> Result<PiaRealtimeStream, PiaError> {
        let ws = PiaRealtimeStream::connect_with_auth(&self.websocket_url(), &self.api_key).await?;
        Ok(PiaRealtimeStream {
            ws,
            reconnect: None,
        })
    }
}

struct RealtimeReconnect {
    ws_url: String,
    api_key: String,
    timeout: std::time::Duration,
    subscriptions: Arc<Mutex<Vec<String>>>,
    explicitly_closed: Arc<std::sync::atomic::AtomicBool>,
}

pub struct PiaRealtimeStream {
    ws: tokio_tungstenite::WebSocketStream<
        tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
    >,
    reconnect: Option<RealtimeReconnect>,
}

impl PiaRealtimeStream {
    /// Subscribes to real-time market trade ticks for specified symbols.
    pub async fn subscribe(&mut self, symbols: &[&str]) -> Result<(), PiaError> {
        if let Some(reconnect) = &self.reconnect {
            let mut stored = reconnect
                .subscriptions
                .lock()
                .map_err(|_| PiaError::AuthFailed("Realtime state unavailable".into()))?;
            for symbol in symbols {
                let normalized = symbol.trim().to_ascii_uppercase();
                if !normalized.is_empty() && !stored.contains(&normalized) {
                    stored.push(normalized);
                }
            }
        }
        let payload = serde_json::json!({
            "action": "subscribe",
            "symbols": symbols
        });
        self.ws
            .send(Message::Text(payload.to_string().into()))
            .await?;
        Ok(())
    }

    /// Reads the next JSON message from the realtime stream.
    pub async fn next_event(&mut self) -> Result<Option<serde_json::Value>, PiaError> {
        loop {
            if self.reconnect.as_ref().is_some_and(|reconnect| {
                reconnect
                    .explicitly_closed
                    .load(std::sync::atomic::Ordering::SeqCst)
            }) {
                return Ok(None);
            }
            while let Some(msg) = self.ws.next().await {
                match msg {
                    Ok(Message::Text(text)) => {
                        if let Ok(value) = serde_json::from_str::<serde_json::Value>(&text) {
                            if value.get("event").and_then(|event| event.as_str()) == Some("pong")
                                || value.get("result").and_then(|result| result.as_str())
                                    == Some("pong")
                            {
                                continue;
                            }
                            return Ok(Some(value));
                        }
                    }
                    Ok(Message::Ping(data)) => {
                        if self.ws.send(Message::Pong(data)).await.is_err() {
                            break;
                        }
                    }
                    Ok(Message::Close(_)) | Err(_) => break,
                    _ => {}
                }
            }

            let Some(reconnect) = self.reconnect.as_ref() else {
                return Ok(None);
            };
            self.ws = Self::reconnect_and_resubscribe(reconnect).await?;
        }
    }

    async fn reconnect_and_resubscribe(
        reconnect: &RealtimeReconnect,
    ) -> Result<
        tokio_tungstenite::WebSocketStream<
            tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
        >,
        PiaError,
    > {
        let mut attempt: u32 = 0;
        loop {
            if reconnect
                .explicitly_closed
                .load(std::sync::atomic::Ordering::SeqCst)
            {
                return Err(PiaError::AuthFailed("Realtime stream closed".into()));
            }
            let base = 1.5_f64.powi(attempt.min(7) as i32);
            tokio::time::sleep(std::time::Duration::from_secs_f64(base.min(15.0))).await;
            let result = tokio::time::timeout(reconnect.timeout, async {
                let mut ws = Self::connect_with_auth(&reconnect.ws_url, &reconnect.api_key).await?;
                let subscriptions = reconnect
                    .subscriptions
                    .lock()
                    .map_err(|_| PiaError::AuthFailed("Realtime state unavailable".into()))?
                    .clone();
                if !subscriptions.is_empty() {
                    let payload =
                        serde_json::json!({"action": "subscribe", "symbols": subscriptions});
                    ws.send(Message::Text(payload.to_string().into())).await?;
                }
                Ok::<_, PiaError>(ws)
            })
            .await;
            match result {
                Ok(Ok(ws)) => return Ok(ws),
                _ => {
                    attempt = attempt.saturating_add(1);
                }
            }
        }
    }

    async fn connect_with_auth(
        ws_url: &str,
        api_key: &str,
    ) -> Result<
        tokio_tungstenite::WebSocketStream<
            tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
        >,
        PiaError,
    > {
        let (mut ws, _) = connect_async(ws_url).await?;
        loop {
            match ws.next().await {
                Some(Ok(Message::Text(text))) => {
                    let value = serde_json::from_str::<serde_json::Value>(&text).ok();
                    if value
                        .as_ref()
                        .and_then(|v| v.get("event"))
                        .and_then(|v| v.as_str())
                        == Some("connected")
                    {
                        break;
                    }
                    if value.as_ref().and_then(|v| v.get("error")).is_some() {
                        return Err(PiaError::AuthFailed(
                            "Realtime authentication failed".into(),
                        ));
                    }
                }
                Some(Ok(Message::Ping(data))) => ws.send(Message::Pong(data)).await?,
                Some(Ok(Message::Close(_))) | None => {
                    return Err(PiaError::AuthFailed("Realtime connection closed".into()))
                }
                Some(Ok(_)) => {}
                Some(Err(error)) => return Err(PiaError::WebSocket(error)),
            }
        }
        let auth = serde_json::json!({"action":"auth","api_key":api_key});
        ws.send(Message::Text(auth.to_string().into())).await?;
        loop {
            match ws.next().await {
                Some(Ok(Message::Text(text))) => {
                    let value = serde_json::from_str::<serde_json::Value>(&text).ok();
                    if value
                        .as_ref()
                        .and_then(|v| v.get("event"))
                        .and_then(|v| v.as_str())
                        == Some("authenticated")
                    {
                        return Ok(ws);
                    }
                    if value.as_ref().and_then(|v| v.get("error")).is_some() {
                        return Err(PiaError::AuthFailed(
                            "Realtime authentication failed".into(),
                        ));
                    }
                }
                Some(Ok(Message::Ping(data))) => ws.send(Message::Pong(data)).await?,
                Some(Ok(Message::Close(_))) | None => {
                    return Err(PiaError::AuthFailed(
                        "Realtime connection closed before authentication".into(),
                    ))
                }
                Some(Ok(_)) => {}
                Some(Err(error)) => return Err(PiaError::WebSocket(error)),
            }
        }
    }

    pub async fn close(&mut self) -> Result<(), PiaError> {
        if let Some(reconnect) = &self.reconnect {
            reconnect
                .explicitly_closed
                .store(true, std::sync::atomic::Ordering::SeqCst);
        }
        let timeout = self
            .reconnect
            .as_ref()
            .map(|state| state.timeout)
            .unwrap_or(std::time::Duration::from_secs(10));
        match tokio::time::timeout(timeout, self.ws.close(None)).await {
            Ok(Ok(()))
            | Ok(Err(
                tokio_tungstenite::tungstenite::Error::ConnectionClosed
                | tokio_tungstenite::tungstenite::Error::AlreadyClosed,
            )) => Ok(()),
            Ok(Err(error)) => Err(PiaError::WebSocket(error)),
            Err(_) => Err(PiaError::AuthFailed("Realtime close timed out".into())),
        }
    }
}

#[derive(Default)]
pub struct PiaClientBuilder {
    api_key: Option<String>,
    base_url: Option<String>,
    ws_url: Option<String>,
    request_timeout: Option<std::time::Duration>,
    realtime_timeout: Option<std::time::Duration>,
}

impl PiaClientBuilder {
    pub fn api_key(mut self, key: impl Into<String>) -> Self {
        self.api_key = Some(key.into());
        self
    }

    pub fn base_url(mut self, url: impl Into<String>) -> Self {
        self.base_url = Some(url.into());
        self
    }

    pub fn ws_url(mut self, url: impl Into<String>) -> Self {
        self.ws_url = Some(url.into());
        self
    }

    pub fn request_timeout(mut self, timeout: std::time::Duration) -> Self {
        self.request_timeout = Some(timeout);
        self
    }

    pub fn realtime_timeout(mut self, timeout: std::time::Duration) -> Self {
        self.realtime_timeout = Some(timeout);
        self
    }

    pub fn build(self) -> Result<PiaClient, PiaError> {
        let api_key = match self.api_key {
            Some(k) if !k.trim().is_empty() => k,
            _ => env::var("PIA_API_KEY")
                .or_else(|_| env::var("ATSLD_API_KEY"))
                .map_err(|_| PiaError::MissingApiKey)?,
        };

        let base_url = match self.base_url {
            Some(u) if !u.trim().is_empty() => u,
            _ => env::var("PIA_BASE_URL").unwrap_or_else(|_| DEFAULT_BASE_URL.to_string()),
        };

        let ws_url = match self.ws_url {
            Some(w) if !w.trim().is_empty() => w,
            _ => env::var("PIA_WS_URL").unwrap_or_else(|_| DEFAULT_WS_URL.to_string()),
        };

        let allow_loopback_http = cfg!(test)
            && reqwest::Url::parse(&base_url)
                .ok()
                .is_some_and(|url| url.scheme() == "http" && url.host_str() == Some("127.0.0.1"));
        if base_url.contains('?') || base_url.contains('#') {
            return Err(PiaError::AuthFailed(
                "Base URL must use HTTPS and contain no embedded credentials".into(),
            ));
        }
        let parsed_base = reqwest::Url::parse(&base_url)
            .map_err(|_| PiaError::AuthFailed("Invalid base URL".into()))?;
        if (parsed_base.scheme() != "https" && !allow_loopback_http)
            || !parsed_base.username().is_empty()
            || parsed_base.password().is_some()
            || parsed_base.query().is_some()
            || parsed_base.fragment().is_some()
        {
            return Err(PiaError::AuthFailed(
                "Base URL must use HTTPS and contain no embedded credentials".into(),
            ));
        }
        let parsed_ws = reqwest::Url::parse(&ws_url)
            .map_err(|_| PiaError::AuthFailed("Invalid WebSocket URL".into()))?;
        let allow_loopback_ws = cfg!(test)
            && parsed_ws.scheme() == "ws"
            && parsed_ws
                .host_str()
                .is_some_and(|host| host == "127.0.0.1" || host == "[::1]" || host == "localhost");
        if (parsed_ws.scheme() != "wss" && !allow_loopback_ws)
            || !parsed_ws.username().is_empty()
            || parsed_ws.password().is_some()
        {
            return Err(PiaError::AuthFailed(
                "WebSocket URL must use WSS and contain no embedded credentials".into(),
            ));
        }

        let mut headers = HeaderMap::new();
        let bearer_val = format!("Bearer {api_key}");
        if let Ok(v) = HeaderValue::from_str(&bearer_val) {
            headers.insert(AUTHORIZATION, v);
        }
        if let Ok(v) = HeaderValue::from_str(&api_key) {
            headers.insert("x-api-key", v);
        }

        let timeout = self
            .request_timeout
            .unwrap_or_else(|| std::time::Duration::from_secs(30));
        let http = Client::builder()
            .timeout(timeout)
            .default_headers(headers)
            .build()
            .map_err(PiaError::Network)?;

        let realtime_timeout = self
            .realtime_timeout
            .unwrap_or_else(|| std::time::Duration::from_secs(10));
        if realtime_timeout.is_zero() {
            return Err(PiaError::AuthFailed(
                "Realtime timeout must be greater than zero".into(),
            ));
        }

        Ok(PiaClient {
            base_url,
            ws_url,
            api_key,
            http,
            realtime_timeout,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_client_init_and_url() {
        let client = PiaClient::builder()
            .api_key("test_key")
            .base_url("https://custom.api")
            .ws_url("wss://custom.api/ws")
            .build()
            .expect("client build failed");

        assert_eq!(client.base_url(), "https://custom.api");
        assert_eq!(client.ws_url(), "wss://custom.api/ws");
    }

    #[test]
    fn insecure_urls_are_rejected() {
        assert!(PiaClient::builder()
            .api_key("synthetic_key")
            .base_url("http://api.example.test")
            .build()
            .is_err());
        assert!(PiaClient::builder()
            .api_key("synthetic_key")
            .ws_url("ws://api.example.test/ws")
            .build()
            .is_err());
    }

    #[test]
    fn base_url_rejects_empty_query_and_fragment_delimiters() {
        for base_url in ["https://custom.api?", "https://custom.api#"] {
            assert!(
                matches!(
                    PiaClient::builder()
                        .api_key("synthetic_key")
                        .base_url(base_url)
                        .build(),
                    Err(PiaError::AuthFailed(_))
                ),
                "base URL: {base_url}"
            );
        }
    }

    #[test]
    fn base_url_allows_path_but_rejects_query_and_fragment() {
        let client = PiaClient::builder()
            .api_key("synthetic_key")
            .base_url("https://custom.api/gateway/v1/")
            .ws_url("wss://custom.api/ws")
            .build()
            .expect("base URL paths should be allowed");
        assert_eq!(client.base_url(), "https://custom.api/gateway/v1/");

        for base_url in [
            "https://custom.api?tenant=one",
            "https://custom.api#section",
            "https://custom.api?",
            "https://custom.api#",
        ] {
            assert!(
                matches!(
                    PiaClient::builder()
                        .api_key("synthetic_key")
                        .base_url(base_url)
                        .build(),
                    Err(PiaError::AuthFailed(_))
                ),
                "base URL: {base_url}"
            );
        }
    }

    #[tokio::test]
    async fn request_times_out_on_stalled_local_response_body() {
        use tokio::io::{AsyncReadExt, AsyncWriteExt};
        use tokio::net::TcpListener;

        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let server = tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.unwrap();
            let mut request = [0; 2048];
            let _ = socket.read(&mut request).await.unwrap();
            socket
                .write_all(b"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 100\r\nConnection: close\r\n\r\n{")
                .await
                .unwrap();
            tokio::time::sleep(std::time::Duration::from_millis(300)).await;
        });

        let client = PiaClient::builder()
            .api_key("synthetic_test_key")
            .base_url(format!("http://{address}"))
            .ws_url("wss://api.example.test/ws")
            .request_timeout(std::time::Duration::from_millis(50))
            .build()
            .unwrap();
        let result =
            tokio::time::timeout(std::time::Duration::from_millis(200), client.get_prices()).await;
        assert!(
            result.is_ok(),
            "request should honor the configured timeout"
        );
        assert!(matches!(result.unwrap(), Err(PiaError::Network(_))));
        server.abort();
    }

    #[test]
    fn request_path_validation_accepts_relative_market_path_and_rejects_absolute_paths() {
        assert!(validate_request_path("/api/v1/market/prices").is_ok());

        for path in ["https://attacker.example/path", "//attacker.example/path"] {
            assert!(
                matches!(validate_request_path(path), Err(PiaError::AuthFailed(_))),
                "path: {path}"
            );
        }
    }

    #[test]
    fn safe_api_error_does_not_contain_raw_body() {
        let raw = r#"{"error":"raw_body_sentinel token=error_fallback_secret"}"#;
        let message = safe_server_message(raw);
        assert!(message.contains("raw_body_sentinel"));
        assert!(!message.contains("error_fallback_secret"));
        let error = PiaError::Api {
            status: StatusCode::BAD_GATEWAY,
            message,
            request_id: Some("req-synthetic".into()),
        };
        let rendered = format!("{error:?} {error}");
        assert!(!rendered.contains("error_fallback_secret"));
        assert!(rendered.contains("502"));
        assert!(rendered.contains("req-synthetic"));
    }

    #[test]
    fn safe_api_error_preserves_explicit_safe_message() {
        let raw = r#"{"detail":"opaque secret detail","message":"safe summary"}"#;
        let message = safe_server_message(raw);
        assert_eq!(message, "safe summary");
    }

    #[test]
    fn safe_server_message_redacts_credentials_and_sensitive_urls() {
        let sentinel = "synthetic_secret_credential";
        for raw in [
            r#"{"message":"request failed with key wi_live_synthetic_secret_credential"}"#
                .to_owned(),
            format!(r#"{{"message":"request failed with Bearer {sentinel}"}}"#),
            format!(
                r#"{{"message":"failed at https://user:{sentinel}@api.example.test/path?token={sentinel}"}}"#
            ),
            r#"{"message":"failed at HTTPS://user:sentinel@example.test"}"#.to_owned(),
        ] {
            let safe = safe_server_message(&raw);
            assert!(!safe.contains(sentinel), "unsafe message: {safe}");
        }
        let mixed_case_scheme =
            safe_server_message(r#"{"message":"failed at HTTPS://user:sentinel@example.test"}"#);
        assert!(
            !mixed_case_scheme.contains("sentinel"),
            "unsafe message: {mixed_case_scheme}"
        );
    }

    #[test]
    fn safe_server_message_falls_back_to_error_field_and_redacts_mixed_case_url() {
        let sentinel = "synthetic_error_credential";
        let raw = format!(
            r#"{{"error":"failed at hTtPs://user:{sentinel}@api.example.test/path?token={sentinel}"}}"#
        );

        let safe = safe_server_message(&raw);
        assert!(
            safe.starts_with("failed at hTtPs://"),
            "error field not used: {safe}"
        );
        assert!(!safe.contains(sentinel), "unsafe message: {safe}");
        assert!(
            safe.contains("[REDACTED]@api.example.test"),
            "userinfo not redacted: {safe}"
        );
        assert!(
            safe.contains("token=[REDACTED]"),
            "query value not redacted: {safe}"
        );
    }

    #[test]
    fn opaque_api_error_body_is_not_exposed() {
        let raw = "<html><body>private_raw_body_secret</body></html>";
        let message = safe_server_message(raw);
        assert_eq!(message, "Server returned an error");
        assert!(!message.contains("private_raw_body_secret"));
    }

    #[test]
    fn safe_server_message_is_capped() {
        let long = "x".repeat(400);
        let body = serde_json::json!({"message": long}).to_string();
        assert_eq!(safe_server_message(&body).len(), 256);
    }

    #[test]
    fn client_debug_redacts_api_key() {
        let client = PiaClient::new("synthetic_secret_api_key").unwrap();
        let rendered = format!("{client:?}");
        assert!(!rendered.contains("synthetic_secret_api_key"));
        assert!(!rendered.contains("https://api-engine.wign.dev"));
    }

    #[tokio::test]
    async fn realtime_reconnect_restores_subscriptions_after_authentication() {
        use tokio::net::TcpListener;
        use tokio_tungstenite::accept_async;

        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let server = tokio::spawn(async move {
            for connection_index in 0..2 {
                let (socket, _) = listener.accept().await.unwrap();
                let mut ws = accept_async(socket).await.unwrap();
                ws.send(Message::Text(r#"{"event":"connected"}"#.into()))
                    .await
                    .unwrap();
                let auth = ws.next().await.unwrap().unwrap();
                assert!(matches!(auth, Message::Text(_)));
                ws.send(Message::Text(r#"{"event":"authenticated"}"#.into()))
                    .await
                    .unwrap();
                let subscription = ws.next().await.unwrap().unwrap();
                assert!(subscription.to_string().contains("XAUUSD"));
                if connection_index == 0 {
                    drop(ws);
                } else {
                    ws.send(Message::Text(
                        r#"{"event":"market.tick","data":{"symbol":"XAUUSD","price":11}}"#.into(),
                    ))
                    .await
                    .unwrap();
                    let _ = ws.next().await;
                }
            }
        });

        let client = PiaClient::builder()
            .api_key("synthetic_test_key")
            .base_url("https://api.example.test")
            .ws_url(format!("ws://{address}/ws"))
            .build()
            .unwrap();
        let mut stream = client.connect_realtime().await.unwrap();
        stream.subscribe(&["XAUUSD"]).await.unwrap();
        let event = tokio::time::timeout(std::time::Duration::from_secs(5), stream.next_event())
            .await
            .unwrap()
            .unwrap();
        assert_eq!(event.unwrap()["event"], "market.tick");
        stream.close().await.unwrap();
        tokio::time::timeout(std::time::Duration::from_secs(2), server)
            .await
            .unwrap()
            .unwrap();
    }

    #[tokio::test]
    async fn realtime_close_sends_close_frame_and_prevents_reconnect() {
        use tokio::net::TcpListener;
        use tokio_tungstenite::accept_async;

        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let server = tokio::spawn(async move {
            let (socket, _) = listener.accept().await.unwrap();
            let mut ws = accept_async(socket).await.unwrap();
            ws.send(Message::Text(r#"{"event":"connected"}"#.into()))
                .await
                .unwrap();
            ws.next().await.unwrap().unwrap();
            ws.send(Message::Text(r#"{"event":"authenticated"}"#.into()))
                .await
                .unwrap();
            matches!(ws.next().await.unwrap().unwrap(), Message::Close(_))
        });

        let mut stream = PiaClient::builder()
            .api_key("synthetic_test_key")
            .base_url("https://api.example.test")
            .ws_url(format!("ws://{address}/ws"))
            .build()
            .unwrap()
            .connect_realtime()
            .await
            .unwrap();
        tokio::time::timeout(std::time::Duration::from_secs(2), stream.close())
            .await
            .unwrap()
            .unwrap();
        assert!(stream.next_event().await.unwrap().is_none());
        assert!(
            tokio::time::timeout(std::time::Duration::from_secs(2), server)
                .await
                .unwrap()
                .unwrap()
        );
    }

    #[tokio::test]
    async fn realtime_authentication_wait_has_a_configured_deadline() {
        use tokio::net::TcpListener;
        use tokio_tungstenite::accept_async;

        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let server = tokio::spawn(async move {
            let (socket, _) = listener.accept().await.unwrap();
            let mut ws = accept_async(socket).await.unwrap();
            ws.send(Message::Text(r#"{"event":"connected"}"#.into()))
                .await
                .unwrap();
            let auth = ws.next().await.unwrap().unwrap();
            let Message::Text(auth) = auth else {
                panic!("expected in-band auth frame")
            };
            assert_eq!(
                serde_json::from_str::<serde_json::Value>(&auth).unwrap()["action"],
                "auth"
            );
            tokio::time::sleep(std::time::Duration::from_millis(200)).await;
        });

        let client = PiaClient::builder()
            .api_key("synthetic_test_key")
            .base_url("https://api.example.test")
            .ws_url(format!("ws://{address}/ws"))
            .realtime_timeout(std::time::Duration::from_millis(40))
            .build()
            .unwrap();
        let result = tokio::time::timeout(
            std::time::Duration::from_millis(500),
            client.connect_realtime(),
        )
        .await;
        assert!(matches!(result, Ok(Err(PiaError::AuthFailed(_)))));
        server.await.unwrap();
    }

    #[tokio::test]
    async fn cancelling_reconnect_preserves_subscription_state() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let server = tokio::spawn(async move {
            let (socket, _) = listener.accept().await.unwrap();
            let mut ws = tokio_tungstenite::accept_async(socket).await.unwrap();
            ws.send(Message::Text(r#"{"event":"connected"}"#.into()))
                .await
                .unwrap();
            ws.next().await.unwrap().unwrap();
            ws.send(Message::Text(r#"{"event":"authenticated"}"#.into()))
                .await
                .unwrap();
            ws.next().await.unwrap().unwrap();
            ws.close(None).await.unwrap();
        });
        let client = PiaClient::builder()
            .api_key("synthetic_test_key")
            .base_url("https://api.example.test")
            .ws_url(format!("ws://{address}/ws"))
            .build()
            .unwrap();
        let mut stream = client.connect_realtime().await.unwrap();
        stream.subscribe(&["XAUUSD"]).await.unwrap();
        assert!(
            tokio::time::timeout(std::time::Duration::from_millis(100), stream.next_event())
                .await
                .is_err()
        );
        let reconnect = stream
            .reconnect
            .as_ref()
            .expect("cancel must preserve reconnect state");
        assert_eq!(*reconnect.subscriptions.lock().unwrap(), vec!["XAUUSD"]);
        server.await.unwrap();
        let _ = stream.close().await;
        assert!(stream.next_event().await.unwrap().is_none());
    }

    #[test]
    fn server_redaction_handles_unicode_and_multiple_urls() {
        let redacted = redact_server_credentials("token=é https://longusername:longpassword@example.test/a https://another:password@other.test/b");
        assert!(!redacted.contains('é'));
        assert!(!redacted.contains("password"));
        assert_eq!(redacted.matches("[REDACTED]@").count(), 2);
    }

    #[test]
    fn missing_api_key_stays_an_error() {
        env::remove_var("PIA_API_KEY");
        env::remove_var("ATSLD_API_KEY");
        let result = PiaClient::builder().build();
        assert!(matches!(result, Err(PiaError::MissingApiKey)));
    }
}
