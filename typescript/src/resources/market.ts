/**
 * Official PIA SDK - Market Intelligence API Resource
 */

import { ValidationError } from "../errors";
import type { HttpTransport } from "../http/transport";
import type {
  CandleResponse,
  GetCandlesOptions,
  MarketPricesResponse,
  OrderBook,
  RequestOptions,
} from "../types";

export class MarketResource {
  constructor(private readonly transport: HttpTransport) {}

  /**
   * Retrieves current multi-asset price snapshot for all tracked global symbols.
   */
  public async getPrices(options?: RequestOptions): Promise<MarketPricesResponse> {
    return this.transport.request<MarketPricesResponse>(
      "/api/v1/market/prices",
      "GET",
      undefined,
      options
    );
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
    if (!symbol || typeof symbol !== "string" || symbol.trim() === "") {
      throw new ValidationError("Symbol must be a non-empty string.", "symbol");
    }

    const cleanSymbol = symbol.trim().toUpperCase();
    const params = new URLSearchParams();
    if (options?.timeframe) params.set("resolution", options.timeframe);
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.since) params.set("since", String(options.since));
    if (options?.until) params.set("before", String(options.until));

    const query = params.toString() ? `?${params.toString()}` : "";
    const raw = await this.transport.request<any>(
      `/api/v1/market/history/${encodeURIComponent(cleanSymbol)}${query}`,
      "GET",
      undefined,
      options
    );

    const candleList = raw?.candles || raw?.items || [];
    return {
      symbol: cleanSymbol,
      timeframe: options?.timeframe || "1m",
      count: candleList.length,
      candles: candleList,
    };
  }

  /**
   * Retrieves Level 2 DOM (Depth of Market) order book for a symbol.
   */
  public async getOrderBook(symbol: string, options?: RequestOptions): Promise<OrderBook> {
    if (!symbol || typeof symbol !== "string" || symbol.trim() === "") {
      throw new ValidationError("Symbol must be a non-empty string.", "symbol");
    }

    const cleanSymbol = symbol.trim().toUpperCase();
    return this.transport.request<OrderBook>(
      `/api/v1/market/orderbook/${encodeURIComponent(cleanSymbol)}`,
      "GET",
      undefined,
      options
    );
  }

  /**
   * Retrieves AI/Quant market insights and price movement narrative for a given instrument.
   */
  public async getInsights(symbol: string, options?: RequestOptions): Promise<any> {
    if (!symbol || typeof symbol !== "string" || symbol.trim() === "") {
      throw new ValidationError("Symbol must be a non-empty string.", "symbol");
    }

    const cleanSymbol = symbol.trim().toUpperCase();
    return this.transport.request<any>(
      `/api/v1/market/insights/${encodeURIComponent(cleanSymbol)}`,
      "GET",
      undefined,
      options
    );
  }

  /**
   * Retrieves active market trading halts and circuit breaker triggers.
   */
  public async getTradingHalts(options?: RequestOptions): Promise<any> {
    return this.transport.request<any>(
      "/api/v1/market/trading-halts",
      "GET",
      undefined,
      options
    );
  }

  /**
   * Retrieves upcoming and historical corporate actions (dividends, splits, earnings).
   */
  public async getCorporateActions(options?: RequestOptions): Promise<any> {
    return this.transport.request<any>(
      "/api/v1/market/corporate-actions",
      "GET",
      undefined,
      options
    );
  }

  /**
   * Calculates historical realized volatility (HV) across rolling windows (10d, 30d, 90d).
   */
  public async getRealizedVolatility(symbol?: string, options?: RequestOptions): Promise<any> {
    const params = new URLSearchParams();
    if (symbol) params.set("symbol", symbol.trim().toUpperCase());
    const query = params.toString() ? `?${params.toString()}` : "";
    return this.transport.request<any>(
      `/api/v1/market/realized-volatility${query}`,
      "GET",
      undefined,
      options
    );
  }

  /**
   * Retrieves implied volatility (IV) surface and ATM volatility index.
   */
  public async getImpliedVolatility(symbol?: string, options?: RequestOptions): Promise<any> {
    const params = new URLSearchParams();
    if (symbol) params.set("symbol", symbol.trim().toUpperCase());
    const query = params.toString() ? `?${params.toString()}` : "";
    return this.transport.request<any>(
      `/api/v1/market/implied-volatility${query}`,
      "GET",
      undefined,
      options
    );
  }

  /**
   * @deprecated Use `getInsights(symbol)` instead.
   */
  public async getWhy(symbol: string, options?: RequestOptions): Promise<any> {
    return this.getInsights(symbol, options);
  }
}
