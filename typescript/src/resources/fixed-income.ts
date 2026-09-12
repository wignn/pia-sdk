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
    return this.transport.request<YieldCurveResponse>(
      "/api/v1/fixed-income/yield-curve",
      "GET",
      undefined,
      options
    );
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
}
