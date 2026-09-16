/**
 * Official PIA SDK - Fixed Income & Sovereign Rates API Resource
 */

import type { HttpTransport } from "../http/transport";
import type { RequestOptions, YieldCurveResponse } from "../types";

export class FixedIncomeResource {
  constructor(private readonly transport: HttpTransport) {}

  /**
   * Retrieves US Treasury sovereign bond yield curve structure across all standard tenors.
   */
  public async getYieldCurve(options?: RequestOptions): Promise<YieldCurveResponse> {
    const raw = await this.transport.request<any>(
      "/api/v1/fixed-income/yield-curve",
      "GET",
      undefined,
      options
    );
    const points = raw?.points || raw?.data || raw?.bonds || [];
    return { ...raw, date: raw?.date || raw?.as_of, points: Array.isArray(points) ? points : [] };
  }

  /**
   * Retrieves sovereign yield spreads (2Y-10Y, 3M-10Y curve steepness indicators).
   */
  public async getSpreads(options?: RequestOptions): Promise<any> {
    return this.transport.request<any>(
      "/api/v1/fixed-income/spreads",
      "GET",
      undefined,
      options
    );
  }

  /** Retrieves the current sovereign rate for a tenor such as 2Y or 10Y. */
  getRate(tenor: string, options?: RequestOptions): Promise<any> {
    if (!tenor || !tenor.trim()) throw new Error("Tenor must be a non-empty string.");
    return this.transport.request<any>(
      `/api/v1/fixed-income/rates/${encodeURIComponent(tenor.trim().toUpperCase())}`,
      "GET",
      undefined,
      options
    );
  }

  /** Retrieves historical yield data for a tenor. */
  public async getHistory(tenor: string, options?: RequestOptions): Promise<any> {
    if (!tenor || !tenor.trim()) throw new Error("Tenor must be a non-empty string.");
    return this.transport.request<any>(
      `/api/v1/rates/history/${encodeURIComponent(tenor.trim().toUpperCase())}`,
      "GET",
      undefined,
      options
    );
  }
}
