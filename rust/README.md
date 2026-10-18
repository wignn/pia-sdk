# pia-sdk

Official Rust client library for the [PIA Market Intelligence Platform](https://pia.wign.dev).

## Quickstart

Add to `Cargo.toml`:

```toml
[dependencies]
pia-sdk = "0.1.0"
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
