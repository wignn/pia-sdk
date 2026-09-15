/**
 * Official PIA SDK - Derivatives & Options Analytics Resource
 */

import { normalizeSymbol } from "../symbols";
import type { HttpTransport } from "../http/transport";
import type {
  OptionChainResponse,
  OptionGexResponse,
  OptionSummaryResponse,
  RequestOptions,
} from "../types";

export class OptionsResource {
  constructor(private readonly transport: HttpTransport) {}

  /**
   * Fetches the real-time option chain for an underlying asset symbol.
   *
   * @param symbol Underlier ticker (e.g. "AAPL", "NVDA", "SPX")
   */
  public async getChain(
    symbol: string,
    options?: RequestOptions
  ): Promise<OptionChainResponse> {
    const clean = normalizeSymbol(symbol);
    const params = new URLSearchParams({ symbol: clean });
    return this.transport.request<OptionChainResponse>(
      `/api/v1/options/chain?${params.toString()}`,
      "GET",
      undefined,
      options
    );
  }

  /**
   * Fetches Gamma Exposure (GEX) profile and key zero-gamma levels.
   *
   * @param symbol Underlier ticker (e.g. "SPX", "NVDA", "QQQ")
   */
  public async getGex(
    symbol: string,
    options?: RequestOptions
  ): Promise<OptionGexResponse> {
    const clean = normalizeSymbol(symbol);
    const params = new URLSearchParams({ symbol: clean });
    return this.transport.request<OptionGexResponse>(
      `/api/v1/options/gex?${params.toString()}`,
      "GET",
      undefined,
      options
    );
  }

  /**
   * Retrieves overall options market activity and put/call sentiment summary.
   */
  public async getSummary(options?: RequestOptions): Promise<OptionSummaryResponse> {
    return this.transport.request<OptionSummaryResponse>(
      "/api/v1/options/summary",
      "GET",
      undefined,
      options
    );
  }
}
