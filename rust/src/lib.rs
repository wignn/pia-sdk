//! Official PIA Rust SDK
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION};
use reqwest::{Client, Method, StatusCode};
use serde::de::DeserializeOwned;
use std::env;
use std::fmt;

pub const DEFAULT_BASE_URL: &str = "https://api-engine.wign.dev";

#[derive(Debug)]
pub enum PiaError {
    MissingApiKey,
    Network(reqwest::Error),
    Api { status: StatusCode, message: String },
    Json(serde_json::Error),
}

impl fmt::Display for PiaError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::MissingApiKey => write!(f, "PIA API key not provided and PIA_API_KEY env not set"),
            Self::Network(e) => write!(f, "Network error: {e}"),
            Self::Api { status, message } => write!(f, "API error ({status}): {message}"),
            Self::Json(e) => write!(f, "JSON error: {e}"),
        }
    }
}

impl std::error::Error for PiaError {}

impl From<reqwest::Error> for PiaError {
    fn from(e: reqwest::Error) -> Self {
        Self::Network(e)
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
        self.request(Method::GET, &format!("/api/v1/market/prices/{symbol}"), None, None).await
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
        let limit_str = limit.map(|l| l.to_string());
        let mut query = vec![("symbol", symbol), ("timeframe", timeframe)];
        if let Some(ref l) = limit_str {
            query.push(("limit", l.as_str()));
        }
        self.request(Method::GET, "/api/v1/market/candles", Some(&query), None).await
    }

    pub async fn get_news(&self) -> Result<serde_json::Value, PiaError> {
        self.request(Method::GET, "/api/v1/news", None, None).await
    }

    pub async fn get_fear_greed(&self) -> Result<serde_json::Value, PiaError> {
        self.request(Method::GET, "/api/v1/fear-greed", None, None).await
    }
}

#[derive(Default)]
pub struct PiaClientBuilder {
    api_key: Option<String>,
    base_url: Option<String>,
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

    pub fn build(self) -> Result<PiaClient, PiaError> {
        let api_key = match self.api_key {
            Some(k) if !k.trim().is_empty() => k,
            _ => env::var("PIA_API_KEY")
                .or_else(|_| env::var("ATSLD_API_KEY"))
                .map_err(|_| PiaError::MissingApiKey)?,
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
            base_url: self.base_url.unwrap_or_else(|| DEFAULT_BASE_URL.to_string()),
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
            .build()
            .expect("client build failed");

        assert_eq!(client.base_url(), "https://custom.api");
    }

    #[test]
    fn test_missing_api_key() {
        env::remove_var("PIA_API_KEY");
        env::remove_var("ATSLD_API_KEY");
        let result = PiaClient::builder().build();
        assert!(matches!(result, Err(PiaError::MissingApiKey)));
    }
}
