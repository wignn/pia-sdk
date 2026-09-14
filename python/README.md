# piaa-sdk (Official Python SDK)

Official, production-grade Python SDK for the **PIA Market Intelligence & Realtime Financial Platform**.

Designed for institutional quantitative trading bots, financial analytics, fintech backends, and data science workflows.

---

## Key Features

- **Simple, Intuitive API**: Start fetching market data in under 3 lines of code with zero unnecessary ceremony.
- **Dual Proxy-Resilient Auth**: Transparently sends both standard `Authorization: Bearer <key>` and `x-api-key` headers to guarantee 100% compatibility across Cloudflare tunnels, enterprise WAFs, and internal gateways.
- **Derivatives & Macro Intelligence**: Real-time Options Chain, Gamma Exposure (GEX), Fear & Greed Index, and CFTC Commitment of Traders (COT) positioning.
- **Cross-Platform Realtime Streaming**: Resilient WebSocket client featuring **In-Band Message Authentication**, ping/pong keep-alives, auto-reconnect, and dynamic symbol subscriptions.
- **Typed Exception Hierarchy**: Actionable exceptions (`AuthenticationError`, `RateLimitError`, `TimeoutError`, `ValidationError`, `NetworkError`) with detailed quota telemetry attributes.
- **Zero Sensitive Data Leaks**: Automatic regex redaction of `wi_live_...` API keys and Bearer tokens in error strings and logs.
- **Dual Sync & Async Support**: Both synchronous (`PiaClient`) and modern asyncio (`AsyncPiaClient`) interfaces available.
- **Type Hinting**: Fully typed with PEP 561 `py.typed` marker for flawless IDE autocompletion and MyPy verification.

---

## Installation

```bash
pip install piaa-sdk
```

---

## Quickstart

### 1. Synchronous REST API

```python
from pia import PiaClient, RateLimitError, AuthenticationError

# Automatically picks up os.environ["PIA_API_KEY"] if omitted
client = PiaClient(api_key="wi_live_your_key")

try:
    # 1. Fetch live multi-asset snapshot (105+ symbols)
    prices = client.market.get_prices()
    print(f"Total instruments tracked: {prices.total}")

    for item in prices.items[:5]:
        print(f"[{item.symbol}] ${item.price:.2f} (bid: {item.bid}, ask: {item.ask})")

    # 2. Fetch historical candlestick bars from ClickHouse
    candles = client.market.get_candles("XAUUSD", timeframe="1h", limit=100)
    print(f"Fetched {candles.count} candles for {candles.symbol}")

    # 3. Options Chain & Gamma Exposure (GEX)
    gex = client.options.get_gex("SPX")
    print(f"SPX Net GEX: ${gex.net_gex:,.2f} (0-Gamma: {gex.zero_gamma_level})")

    # 4. Macro Sentiment & Institutional Positioning
    fg = client.macro.get_fear_greed()
    print(f"Fear & Greed Index: {fg.score} ({fg.rating})")

    cot = client.macro.get_cot("GOLD")
    print(f"Gold Commercial Net Position: {cot.reports[0].net_position}")

    # 5. Social Discussions & Breaking News
    posts = client.social.get_posts(limit=10, symbol="BTC")
    print(f"Latest tweet by @{posts.items[0].author_username}: {posts.items[0].text}")

    # 6. Check rate limit telemetry
    quota = client.get_rate_limit_info()
    print(f"Remaining daily requests: {quota.daily_remaining}/{quota.daily_limit}")

except AuthenticationError:
    print("Invalid or expired API key.")
except RateLimitError as e:
    print(f"Rate limited! Retry after {e.retry_after_seconds} seconds.")
except Exception as e:
    print(f"Unexpected error: {e}")
finally:
    client.close()
```

---

### 2. Asynchronous REST API (`asyncio` / FastAPI)

```python
import asyncio
from pia import AsyncPiaClient

async def main():
    async with AsyncPiaClient(api_key="wi_live_...") as client:
        # Fetch live market snapshot
        prices = await client.market.get_prices()
        print(f"Total instruments: {prices.total}")

        # Fetch option chain
        chain = await client.options.get_chain("NVDA")
        print(f"NVDA Option Expirations: {len(chain.expirations)}")

        # Fetch breaking news
        news = await client.news.get_news(symbols=["XAUUSD", "BTCUSDT"])
        print(f"Latest news: {news.items[0].title}")

asyncio.run(main())
```

---

### 3. Realtime WebSocket Streaming (In-Band Message Auth)

Stream real-time price ticks over asynchronous WebSocket with auto-reconnection:

```python
import asyncio
from pia import AsyncPiaClient

async def main():
    async with AsyncPiaClient(api_key="wi_live_...") as client:
        async for tick in client.realtime.stream(["XAUUSD", "BTCUSDT", "EURUSD"]):
            print(f"[TICK] {tick.symbol} -> ${tick.price:.2f} (bid: {tick.bid}, ask: {tick.ask})")

asyncio.run(main())
```

---

## Complete Resource Reference

| Resource | Methods | Description |
|---|---|---|
| `client.market` | `get_prices()`, `get_candles()`, `get_order_book()` | Live price snapshot, ClickHouse OHLCV history, Level 2 DOM order book. |
| `client.options` | `get_chain()`, `get_gex()`, `get_summary()` | Full option chains, Gamma Exposure levels, put/call volume and sentiment. |
| `client.macro` | `get_fear_greed()`, `get_cot()`, `get_central_bank_stance()` | Fear & Greed sentiment index, CFTC institutional positioning reports, central bank policy stance. |
| `client.social` | `get_posts()`, `get_feed()` | Real-time social sentiment feeds from Twitter/𝕏 ingestion pipeline. |
| `client.news` | `get_news()` | Curated financial breaking news headlines and articles. |
| `client.economic` | `get_calendar()` | Global macroeconomic calendar events and CPI indicators. |
| `client.fixed_income` | `get_yield_curve()` | Sovereign bond yield curves across tenors. |
| `client.ws` | `create_ticket()` | Ephemeral single-use WebSocket connection tickets. |
| `client.realtime` | `stream()`, `subscribe()`, `connect()` | High-throughput asynchronous streaming socket client. |

---

## Configuration Reference

```python
from pia import PiaConfig, PiaClient

config = PiaConfig(
    api_key="wi_live_...",
    base_url="https://api-engine.wign.dev",
    ws_url="wss://api-engine.wign.dev/api/v1/ws",
    timeout=10.0,
    max_retries=3,
    retry_delay=0.5,
    headers={"X-App-Env": "production"},
    debug=False,
)

client = PiaClient(config=config)
```

---

## Running Tests

```bash
pytest
```
