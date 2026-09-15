/**
 * Official PIA SDK - Derivatives & Options Analytics Resource
 */

import { ValidationError } from "../errors";
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
    if (!symbol || typeof symbol !== "string" || symbol.trim() === "") {
      throw new ValidationError("Symbol must be a non-empty string.", "symbol");
    }

    const clean = symbol.trim().toUpperCase();
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
    if (!symbol || typeof symbol !== "string" || symbol.trim() === "") {
      throw new ValidationError("Symbol must be a non-empty string.", "symbol");
    }

    const clean = symbol.trim().toUpperCase();
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
