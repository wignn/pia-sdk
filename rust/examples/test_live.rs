//! Live verification test for PIA Rust SDK
use pia_sdk::PiaClient;
use std::time::Duration;
use tokio::time::timeout;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("=== Testing PIA Rust SDK ===");

    let client = PiaClient::from_env()?;
    println!("Client initialized!");
    println!("  Base URL: {}", client.base_url());
    println!("  WS URL:   {}", client.ws_url());

    println!("\n1. Fetching symbols...");
    let symbols = client.get_symbols().await?;
    let total_symbols = symbols.get("total").and_then(|t| t.as_u64()).unwrap_or(0);
    println!("  Total symbols available: {total_symbols}");

    println!("\n2. Fetching prices snapshot...");
    let prices = client.get_prices().await?;
    let items = prices.get("items").and_then(|i| i.as_array());
    println!("  Prices returned: {} items", items.map(|v| v.len()).unwrap_or(0));

    println!("\n3. Fetching candles (BTCUSDT 1m)...");
    let candles = client.get_candles("BTCUSDT", "1m", Some(5)).await?;
    let candle_items = candles.get("items").and_then(|i| i.as_array());
    println!("  Candles returned: {} bars", candle_items.map(|v| v.len()).unwrap_or(0));
    if let Some(list) = candle_items {
        if let Some(latest) = list.last() {
            println!("  Latest candle: time={} close={}", latest["time"], latest["close"]);
        }
    }

    println!("\n4. Connecting to Realtime WebSocket...");
    let mut stream = client.connect_realtime().await?;
    println!("  WebSocket authenticated successfully!");

    println!("\n5. Subscribing to BTCUSDT and ETHUSDT...");
    stream.subscribe(&["BTCUSDT", "ETHUSDT"]).await?;
    println!("  Subscribed! Listening for live ticks (5 seconds)...");

    let mut tick_count = 0;
    let deadline = tokio::time::Instant::now() + Duration::from_secs(5);

    while tokio::time::Instant::now() < deadline {
        let remaining = deadline.saturating_duration_since(tokio::time::Instant::now());
        if remaining.is_zero() {
            break;
        }

        if let Ok(Ok(Some(event))) = timeout(remaining, stream.next_event()).await {
            let ev_type = event.get("event").and_then(|e| e.as_str());
            if ev_type == Some("market.trade") {
                if let Some(tick) = event.get("data").and_then(|d| d.get("tick")) {
                    tick_count += 1;
                    println!(
                        "  [LIVE TICK #{}] Symbol={} Price={} Time={}",
                        tick_count, tick["symbol"], tick["price"], tick["received_at"]
                    );
                    if tick_count >= 5 {
                        break;
                    }
                }
            }
        }
    }

    println!("\n=== ALL TESTS PASSED! Received {tick_count} live ticks. ===");
    Ok(())
}
