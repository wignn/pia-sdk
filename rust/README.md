# pia-sdk

Official Rust client library for the [PIA Market Intelligence Platform](https://pia.wign.dev).

## Realtime WebSocket

`connect_realtime()` sends authentication after the gateway's `connected` frame and applies a 10-second default connect/authentication deadline. Configure it with `.realtime_timeout(Duration)`. `PiaRealtimeStream::next_event()` reconnects with bounded exponential backoff, authenticates again, restores tracked subscriptions, and filters `pong` frames from application events. Call `close().await` for explicit shutdown. Market-event timestamps are not synthesized by the SDK.

This crate supports only its existing market, candle, news, fear/greed, and realtime operations; REST endpoint parity with the TypeScript/Python SDKs is not implied.

## Quickstart

Add to `Cargo.toml`:

```toml
[dependencies]
pia-sdk = "0.1.1"
tokio = { version = "1", features = ["full"] }
```

```rust
use pia_sdk::PiaClient;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = PiaClient::from_env()?; // reads PIA_API_KEY
    let prices = client.get_prices().await?;
    println!("{prices:#?}");
    Ok(())
}
```
