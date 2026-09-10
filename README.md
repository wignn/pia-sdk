# PIA Official Client SDKs

<p align="center">
  <a href="https://pia.wign.dev"><img src="https://pia.wign.dev/logo.png" alt="PIA Logo" width="80" height="80" /></a>
</p>

<p align="center">
  <strong>Official, enterprise-grade client libraries for the PIA Financial & Market Intelligence Platform.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@piaa/sdk"><img src="https://img.shields.io/npm/v/@piaa/sdk?color=blue&label=npm%20%40piaa%2Fsdk" alt="npm version" /></a>
  <a href="https://pypi.org/project/piaa-sdk/"><img src="https://img.shields.io/pypi/v/piaa-sdk?color=green&label=PyPI%20piaa-sdk" alt="PyPI version" /></a>
  <a href="https://github.com/wignn/pia-sdk/actions/workflows/ci.yml"><img src="https://github.com/wignn/pia-sdk/actions/workflows/ci.yml/badge.svg" alt="CI Status" /></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT" /></a>
</p>

---

## Polyglot Monorepo Structure

| Package | Language | Registry | Directory | Status |
|---|---|---|---|---|
| **`@piaa/sdk`** | TypeScript / JavaScript | [npm](https://www.npmjs.com/package/@piaa/sdk) | [`/typescript`](./typescript) | ![npm](https://img.shields.io/npm/v/@piaa/sdk) |
| **`piaa-sdk`** | Python (Sync & Async) | [PyPI](https://pypi.org/project/piaa-sdk/) | [`/python`](./python) | ![PyPI](https://img.shields.io/pypi/v/piaa-sdk) |

---

## Architectural Highlights

- **Unified API Gateway**: Clean routing for both REST and WebSocket under `api-engine.wign.dev`:
  - REST Base URL: `https://api-engine.wign.dev`
  - Realtime Stream: `wss://api-engine.wign.dev/api/v1/ws`
- **In-Band Message Authentication**: Opens WebSocket connections cleanly without token query strings (preventing URL leakage in browser histories and proxy logs) and authenticates via an encrypted initial frame.
- **Enterprise-Grade Resiliency**: Automatic exponential backoff with full jitter on transient failures (`408`, `429`, `500`, `502`, `503`, `504`) and adherence to HTTP `Retry-After` headers.
- **Real-time Quota Telemetry**: Native parsing of RFC 6585 and daily quota headers (`X-RateLimit-*`, `X-DailyQuota-*`).
- **Typed Exception Hierarchy**: Actionable, structured error classes (`AuthenticationError`, `RateLimitError`, `TimeoutError`, `ValidationError`, `PermissionError`).
- **Zero Sensitive Data Leaks**: Automatic regex sanitization of API keys (`wi_live_...`) and Bearer tokens in error strings and logs.

---

## Quickstart: TypeScript / Node.js

### Installation

```bash
bun add @piaa/sdk
# or
npm install @piaa/sdk
```

### Usage

```typescript
import { PiaClient } from "@piaa/sdk";

const client = new PiaClient({ apiKey: "wi_live_..." });

// 1. Fetch live multi-asset snapshot (105+ symbols)
const prices = await client.market.getPrices();
console.log(`Tracked instruments: ${prices.total}`);

// 2. Realtime WebSocket Streaming (In-Band Message Auth)
client.realtime.on("authenticated", () => {
  client.realtime.subscribe(["XAUUSD", "BTCUSDT"]);
});

client.realtime.on("tick", (tick) => {
  console.log(`[TICK] ${tick.symbol} -> $${tick.price}`);
});

client.realtime.connect();
```

[Read TypeScript SDK Documentation](./typescript/README.md)

---

## Quickstart: Python (Sync & Async)

### Installation

```bash
pip install piaa-sdk
```

### Synchronous Usage

```python
from pia import PiaClient

client = PiaClient(api_key="wi_live_...")

# 1. Fetch live market prices
prices = client.market.get_prices()
for item in prices.items[:5]:
    print(f"[{item.symbol}] ${item.price} (bid: {item.bid}, ask: {item.ask})")

# 2. Fetch historical candlestick bars from ClickHouse
candles = client.market.get_candles("XAUUSD", timeframe="1m", limit=10)
print(f"Fetched {candles.count} candles for {candles.symbol}")
```

### Asynchronous Realtime Streaming

```python
import asyncio
from pia import AsyncPiaClient

async def main():
    async with AsyncPiaClient(api_key="wi_live_...") as client:
        async for tick in client.realtime.stream(["XAUUSD", "BTCUSDT"]):
            print(f"[TICK] {tick.symbol} -> ${tick.price:.2f}")

asyncio.run(main())
```

[Read Python SDK Documentation](./python/README.md)

---

## Security

Please report vulnerabilities directly to `wign@wign.dev` or through a private advisory on GitHub. See [SECURITY.md](./SECURITY.md) for full details.

---

## License

MIT © 2026 wign <wign@wign.dev> (See [LICENSE](./LICENSE)).
