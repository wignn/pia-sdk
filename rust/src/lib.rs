//! Official PIA Rust SDK
use futures_util::{SinkExt, StreamExt};
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION};
use reqwest::{Client, Method, StatusCode};
use serde::de::DeserializeOwned;
use std::env;
use std::fmt;
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::Message;

pub const DEFAULT_BASE_URL: &str = "https://api-engine.wign.dev";
pub const DEFAULT_WS_URL: &str = "wss://api-engine.wign.dev/api/v1/ws";

#[derive(Debug)]
pub enum PiaError {
    MissingApiKey,
    Network(reqwest::Error),
    WebSocket(tokio_tungstenite::tungstenite::Error),
    Api { status: StatusCode, message: String },
    Json(serde_json::Error),
    AuthFailed(String),
}

impl fmt::Display for PiaError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::MissingApiKey => write!(f, "PIA API key not provided and PIA_API_KEY env not set"),
            Self::Network(e) => write!(f, "Network error: {e}"),
            Self::WebSocket(e) => write!(f, "WebSocket error: {e}"),
            Self::Api { status, message } => write!(f, "API error ({status}): {message}"),
            Self::Json(e) => write!(f, "JSON error: {e}"),
            Self::AuthFailed(msg) => write!(f, "Authentication failed: {msg}"),
        }
    }
}

impl std::error::Error for PiaError {}

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

#[derive(Clone, Debug)]
pub struct PiaClient {
    base_url: String,
    ws_url: String,
    api_key: String,
    http: Client,
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
        let url = format!("{}/{}", self.base_url.trim_end_matches('/'), path.trim_start_matches('/'));
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
            let message = res.text().await.unwrap_or_default();
            return Err(PiaError::Api { status, message });
        }

        Ok(res.json().await?)
    }

    pub async fn get_prices(&self) -> Result<serde_json::Value, PiaError> {
        self.request(Method::GET, "/api/v1/market/prices", None, None).await
    }

    pub async fn get_price(&self, symbol: &str) -> Result<serde_json::Value, PiaError> {
        let clean = symbol.trim().to_uppercase();
        self.request(Method::GET, &format!("/api/v1/market/prices/{clean}"), None, None).await
    }

    pub async fn get_symbols(&self) -> Result<serde_json::Value, PiaError> {
        self.request(Method::GET, "/api/v1/market/symbols", None, None).await
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
        self.request(Method::GET, "/api/v1/fear-greed", None, None).await
    }

    /// Connects to the Realtime WebSocket gateway and completes in-band authentication.
    pub async fn connect_realtime(&self) -> Result<PiaRealtimeStream, PiaError> {
        let mut target_url = self.ws_url.clone();
        if target_url.starts_with("http://") {
            target_url = target_url.replacen("http://", "ws://", 1);
        } else if target_url.starts_with("https://") {
            target_url = target_url.replacen("https://", "wss://", 1);
        }

        let (mut ws_stream, _) = connect_async(&target_url).await?;

        // 1. Wait for server's initial connected frame
        while let Some(msg) = ws_stream.next().await {
            let msg = msg?;
            if let Message::Text(text) = msg {
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(&text) {
                    if v.get("event").and_then(|e| e.as_str()) == Some("connected") {
                        break;
                    }
                }
            }
        }

        // 2. Send in-band auth frame
        let auth_payload = serde_json::json!({
            "action": "auth",
            "api_key": &self.api_key
        });
        ws_stream.send(Message::Text(auth_payload.to_string().into())).await?;

        // 3. Await authenticated confirmation
        while let Some(msg) = ws_stream.next().await {
            let msg = msg?;
            if let Message::Text(text) = msg {
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(&text) {
                    if v.get("event").and_then(|e| e.as_str()) == Some("authenticated") {
                        return Ok(PiaRealtimeStream { ws: ws_stream });
                    }
                    if let Some(err) = v.get("error") {
                        return Err(PiaError::AuthFailed(err.to_string()));
                    }
                }
            }
        }

        Err(PiaError::AuthFailed("WebSocket disconnected before authentication".into()))
    }
}

pub struct PiaRealtimeStream {
    ws: tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>,
}

impl PiaRealtimeStream {
    /// Subscribes to real-time market trade ticks for specified symbols.
    pub async fn subscribe(&mut self, symbols: &[&str]) -> Result<(), PiaError> {
        let payload = serde_json::json!({
            "action": "subscribe",
            "symbols": symbols
        });
        self.ws.send(Message::Text(payload.to_string().into())).await?;
        Ok(())
    }

    /// Reads the next JSON message from the realtime stream.
    pub async fn next_event(&mut self) -> Result<Option<serde_json::Value>, PiaError> {
        while let Some(msg) = self.ws.next().await {
            match msg? {
                Message::Text(text) => {
                    if let Ok(v) = serde_json::from_str::<serde_json::Value>(&text) {
                        return Ok(Some(v));
                    }
                }
                Message::Ping(data) => {
                    self.ws.send(Message::Pong(data)).await?;
                }
                Message::Close(_) => return Ok(None),
                _ => {}
            }
        }
        Ok(None)
    }
}

#[derive(Default)]
pub struct PiaClientBuilder {
    api_key: Option<String>,
    base_url: Option<String>,
    ws_url: Option<String>,
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

        let mut headers = HeaderMap::new();
        let bearer_val = format!("Bearer {api_key}");
        if let Ok(v) = HeaderValue::from_str(&bearer_val) {
            headers.insert(AUTHORIZATION, v);
        }
        if let Ok(v) = HeaderValue::from_str(&api_key) {
            headers.insert("x-api-key", v);
        }

        let http = Client::builder()
            .default_headers(headers)
            .build()
            .map_err(PiaError::Network)?;

        Ok(PiaClient {
            base_url,
            ws_url,
            api_key,
            http,
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
    fn test_missing_api_key() {
        env::remove_var("PIA_API_KEY");
        env::remove_var("ATSLD_API_KEY");
        let result = PiaClient::builder().build();
        assert!(matches!(result, Err(PiaError::MissingApiKey)));
    }
}
