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
    const raw = await this.transport.request<any>(
      `/api/v1/options/chain?${params.toString()}`,
      "GET",
      undefined,
      options
    );
    const payload = raw?.data || raw;
    return {
      symbol: payload?.symbol || clean,
      underlying_price: payload?.underlying_price,
      expirations: payload?.expirations || [],
      contracts: payload?.contracts || payload?.items || [],
    };
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
    const raw = await this.transport.request<any>(
      `/api/v1/options/gex?${params.toString()}`,
      "GET",
      undefined,
      options
    );
    const payload = raw?.data || raw;
    const rows = Array.isArray(payload) ? payload : payload?.items || payload?.data;
    const callGex = Array.isArray(rows)
      ? rows.reduce((sum: number, row: any) => sum + Number(row?.call_gex || 0), 0)
      : undefined;
    const putGex = Array.isArray(rows)
      ? rows.reduce((sum: number, row: any) => sum + Number(row?.put_gex || 0), 0)
      : undefined;
    return {
      ...(Array.isArray(payload) ? {} : payload),
      symbol: Array.isArray(payload) ? clean : payload?.symbol || clean,
      net_gex: Array.isArray(payload) ? (callGex || 0) + (putGex || 0) : payload?.net_gex ?? (callGex || 0) + (putGex || 0),
      total_call_gex: Array.isArray(payload) ? callGex : payload?.total_call_gex,
      total_put_gex: Array.isArray(payload) ? putGex : payload?.total_put_gex,
      data: Array.isArray(rows) ? rows : payload?.data,
      items: Array.isArray(rows) ? rows : payload?.items,
    } as OptionGexResponse;
  }

  /**
   * Retrieves overall options market activity and put/call sentiment summary.
   */
  public async getSummary(options?: RequestOptions): Promise<OptionSummaryResponse> {
    const raw = await this.transport.request<any>(
      "/api/v1/options/summary",
      "GET",
      undefined,
      options
    );
    const payload = raw?.data && typeof raw.data === "object" ? raw.data : raw;
    const snapshots = Array.isArray(payload) ? payload : payload?.items || payload?.data || [];
    const first = Array.isArray(snapshots) ? snapshots[0] : snapshots;
    return first && typeof first === "object" ? { ...first, data: snapshots } : { data: snapshots } as OptionSummaryResponse;
  }
}
