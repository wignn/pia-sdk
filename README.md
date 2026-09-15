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

| Package | Language | Version | Registry | Directory | Status |
|---|---|---|---|---|---|
| **`@piaa/sdk`** | TypeScript / JavaScript | **`1.3.4`** | [npm](https://www.npmjs.com/package/@piaa/sdk) | [`/typescript`](./typescript) | ![npm](https://img.shields.io/npm/v/@piaa/sdk) |
| **`piaa-sdk`** | Python (Sync & Async) | **`1.3.4`** | [PyPI](https://pypi.org/project/piaa-sdk/) | [`/python`](./python) | ![PyPI](https://img.shields.io/pypi/v/piaa-sdk) |

---

## Complete API Surface & Capability Matrix

Both TypeScript and Python SDKs expose 100% of the PIA Engine backend microservices:

| Resource Domain | Methods / Capabilities | Endpoints Covered |
|---|---|---|
| **`market`** | `getPrices()`, `getSymbols()`, `getCandles()`, `getOrderBook()`, `getTradingHalts()`, `getCorporateActions()`, `getRealizedVolatility()`, `getImpliedVolatility()` | `/api/v1/market/*` |
| **`intelligence`** | `analyze()`, `getInsights()` | `/api/v1/intelligence/analyze`, `/api/v1/market/insights/*` |
| **`options`** | `getChain()`, `getGex()`, `getSummary()` | `/api/v1/options/*` |
| **`macro`** | `getFearGreed()`, `getCot()`, `getCentralBankStance()` | `/api/v1/fear-greed`, `/api/v1/cot/*`, `/api/v1/central-banks/*` |
| **`geosignals`** | `getEvents()`, `getMap()`, `getAssetImpacts()` | `/api/v1/geosignals/*` |
| **`energy`** | `getDashboard()`, `getSeries()` | `/api/v1/energy/*` |
| **`sec`** | `getFilings()`, `getCompany()` | `/api/v1/sec/*` |
| **`social`** | `getPosts()`, `getFeed()` | `/api/v1/social/*` |
| **`news`** | `getNews()` | `/api/v1/news` |
| **`economic`** | `getCalendar()`, `getIndicators()`, `getCategories()`, `getCountries()` | `/api/v1/economic/*` |
| **`fixedIncome`** | `getYieldCurve()` | `/api/v1/rates/yield-curve` |
| **`ws`** | `createTicket()` | `/api/v1/ws/ticket` |
| **`realtime`** | `connect()`, `subscribe()`, `stream()`, `disconnect()` | `/api/v1/ws` |

---

## Architectural Highlights

- **Dual Proxy-Resilient Auth**: Transparently sends both standard `Authorization: Bearer <key>` and `x-api-key` headers to guarantee 100% compatibility across Cloudflare tunnels, enterprise WAFs, and internal gateways.
- **In-Band Message Authentication**: Opens WebSocket connections cleanly without token query strings (preventing URL leakage in browser histories and proxy logs) and authenticates via an encrypted initial frame.
- **Enterprise Resiliency**: Automatic exponential backoff with full jitter on transient failures (`408`, `429`, `500`, `502`, `503`, `504`) and adherence to HTTP `Retry-After` headers.
- **Real-time Quota Telemetry**: Native parsing of RFC 6585 and daily quota headers (`X-RateLimit-*`, `X-DailyQuota-*`).
- **Typed Exception Hierarchy**: Actionable, structured error classes (`AuthenticationError`, `RateLimitError`, `TimeoutError`, `ValidationError`, `PermissionError`).
- **Zero Sensitive Data Leaks**: Automatic regex sanitization of API keys (`wi_live_...`) and Bearer tokens in error strings and logs.

---

## License

MIT © 2026 wign <wign@wign.dev> (See [LICENSE](./LICENSE)).
