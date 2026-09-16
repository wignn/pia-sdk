/**
 * Official PIA SDK - Market Intelligence API Resource
 */

import { normalizeSymbol } from "../symbols";
import type { HttpTransport } from "../http/transport";
import type {
  CandleResponse,
  GetCandlesOptions,
  GetSymbolsOptions,
  MarketPricesResponse,
  MarketPrice,
  OrderBook,
  RequestOptions,
  SymbolsResponse,
} from "../types";

export class MarketResource {
  constructor(private readonly transport: HttpTransport) {}

  /**
   * Retrieves the catalog of all supported and tradable market instruments with precision & exchange metadata.
   */
  public async getSymbols(options?: GetSymbolsOptions): Promise<SymbolsResponse> {
    const params = new URLSearchParams();
    if (options?.asset_type) params.set("asset_type", options.asset_type);
    if (options?.search) params.set("search", options.search);
    if (options?.exchange) params.set("exchange", options.exchange);
    if (options?.limit !== undefined) params.set("limit", String(options.limit));
    if (options?.offset !== undefined) params.set("offset", String(options.offset));

    const query = params.toString() ? `?${params.toString()}` : "";
    return this.transport.request<SymbolsResponse>(
      `/api/v1/market/symbols${query}`,
      "GET",
      undefined,
      options
    );
  }

  /**
   * Retrieves current multi-asset price snapshot for all tracked global symbols.
   */
  public async getPrices(options?: RequestOptions): Promise<MarketPricesResponse> {
    const raw = await this.transport.request<MarketPricesResponse>(
        "/api/v1/market/prices",
        "GET",
        undefined,
        options
      );
      return { ...raw, items: Array.isArray(raw?.items) ? raw.items : [] };
  }

  /** Retrieves the latest quote for a single symbol. */
  public async getPrice(symbol: string, options?: RequestOptions): Promise<MarketPrice> {
    const cleanSymbol = normalizeSymbol(symbol);
    return this.transport.request<MarketPrice>(
      `/api/v1/market/prices/${encodeURIComponent(cleanSymbol)}`,
      "GET",
      undefined,
      options
    );
  }

  /** Retrieves the current exchange session state for a symbol. */
  public async getSession(symbol: string, options?: RequestOptions): Promise<unknown> {
    const cleanSymbol = normalizeSymbol(symbol);
    return this.transport.request<unknown>(
      `/api/v1/market/session/${encodeURIComponent(cleanSymbol)}`,
      "GET",
      undefined,
      options
    );
  }

  /** Retrieves data-quality and freshness diagnostics for market feeds. */
  public async getDataQuality(options?: RequestOptions): Promise<unknown> {
    return this.transport.request<unknown>("/api/v1/market/data-quality", "GET", undefined, options);
  }

  /** Retrieves detected short-window price spikes. */
  public async getSpikes(options?: RequestOptions): Promise<unknown> {
    return this.transport.request<unknown>("/api/v1/market/spikes", "GET", undefined, options);
  }

  /** Retrieves configured market alerts. */
  public async getAlerts(options?: RequestOptions): Promise<unknown> {
    return this.transport.request<unknown>("/api/v1/market/alerts", "GET", undefined, options);
  }

  /** Retrieves server-side smart alerts. */
  public async getSmartAlerts(options?: RequestOptions): Promise<unknown> {
    return this.transport.request<unknown>("/api/v1/market/smart-alerts", "GET", undefined, options);
  }

  /**
   * Fetches historical OHLCV candlestick bars for a given symbol and timeframe.
   *
   * @param symbol Alphanumeric instrument symbol (e.g. "XAUUSD", "BTCUSDT", "BBCA")
   * @param options Timeframe ("1m", "5m", "15m", "1h", "4h", "1d"), limit, timestamps
   */
  public async getCandles(
    symbol: string,
    options?: GetCandlesOptions
  ): Promise<CandleResponse> {
    const cleanSymbol = normalizeSymbol(symbol);
    const params = new URLSearchParams();
    if (options?.timeframe) params.set("resolution", options.timeframe);
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.since) params.set("since", String(options.since));
    if (options?.until) params.set("before", String(options.until));

    const query = params.toString() ? `?${params.toString()}` : "";
    const raw = await this.transport.request<{
      candles?: CandleResponse["candles"];
      items?: CandleResponse["candles"];
      has_more?: boolean;
      next_before?: number | null;
    }>(
      `/api/v1/market/history/${encodeURIComponent(cleanSymbol)}${query}`,
      "GET",
      undefined,
      options
    );

    const candleList = raw.candles || raw.items || [];
    return {
      symbol: cleanSymbol,
      timeframe: options?.timeframe || "1m",
      count: candleList.length,
      candles: candleList,
      has_more: raw?.has_more,
      next_before: raw?.next_before,
    };
  }

  /**
   * Retrieves Level 2 DOM (Depth of Market) order book for a symbol.
   */
  public async getOrderBook(symbol: string, options?: RequestOptions): Promise<OrderBook> {
    const cleanSymbol = normalizeSymbol(symbol);
    const raw = await this.transport.request<any>(
      `/api/v1/market/orderbook/${encodeURIComponent(cleanSymbol)}`,
      "GET",
      undefined,
      options
    );
    const data = raw?.data && typeof raw.data === "object" ? raw.data : raw;
    return {
      symbol: data?.symbol || cleanSymbol,
      bids: Array.isArray(data?.bids) ? data.bids : [],
      asks: Array.isArray(data?.asks) ? data.asks : [],
      timestamp: Number(data?.timestamp || Date.now()),
    };
  }

  /**
   * Retrieves AI/Quant market insights and price movement narrative for a given instrument.
   */
  public async getInsights(symbol: string, options?: RequestOptions): Promise<unknown> {
    const cleanSymbol = normalizeSymbol(symbol);
    return this.transport.request<unknown>(
      `/api/v1/market/insights/${encodeURIComponent(cleanSymbol)}`,
      "GET",
      undefined,
      options
    );
  }

  /**
   * Retrieves active market trading halts and circuit breaker triggers.
   */
  public async getTradingHalts(options?: RequestOptions): Promise<unknown> {
    return this.transport.request<unknown>(
      "/api/v1/market/trading-halts",
      "GET",
      undefined,
      options
    );
  }

  /**
   * Retrieves upcoming and historical corporate actions (dividends, splits, earnings).
   */
  public async getCorporateActions(options?: RequestOptions): Promise<unknown> {
    return this.transport.request<unknown>(
      "/api/v1/market/corporate-actions",
      "GET",
      undefined,
      options
    );
  }

  /**
   * Calculates historical realized volatility (HV) across rolling windows (10d, 30d, 90d).
   */
  public async getRealizedVolatility(symbol?: string, options?: RequestOptions): Promise<unknown> {
    const params = new URLSearchParams();
    if (symbol !== undefined) params.set("symbol", normalizeSymbol(symbol));
    const query = params.toString() ? `?${params.toString()}` : "";
    return this.transport.request<unknown>(
      `/api/v1/market/realized-volatility${query}`,
      "GET",
      undefined,
      options
    );
  }

  /**
   * Retrieves implied volatility (IV) surface and ATM volatility index.
   */
  public async getImpliedVolatility(symbol?: string, options?: RequestOptions): Promise<unknown> {
    const params = new URLSearchParams();
    if (symbol !== undefined) params.set("symbol", normalizeSymbol(symbol));
    const query = params.toString() ? `?${params.toString()}` : "";
    return this.transport.request<unknown>(
      `/api/v1/market/implied-volatility${query}`,
      "GET",
      undefined,
      options
    );
  }

  /**
   * @deprecated Use `getInsights(symbol)` instead.
   */
  public async getWhy(symbol: string, options?: RequestOptions): Promise<unknown> {
    return this.getInsights(symbol, options);
  }
}
