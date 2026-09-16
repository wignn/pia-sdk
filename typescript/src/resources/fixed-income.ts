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
    const payload = raw?.data && typeof raw.data === "object" ? raw.data : raw;
    const points = payload?.points || payload?.data || payload?.bonds || [];
    const normalized = Array.isArray(points)
      ? points.map((p: any) => ({
          tenor: p.tenor || p.symbol || p.name,
          yield: Number(p.yield ?? p.yield_value ?? p.value),
          date: p.date,
        })).filter((p: any) => p.tenor && Number.isFinite(p.yield))
      : [];
    const spreads = Array.isArray(payload?.spreads) ? payload.spreads : [];
    const findSpread = (short: string, long: string) => {
      const row = spreads.find((item: any) => String(item?.spread || '').toUpperCase().includes(`${short}-${long}`));
      return row?.value !== undefined ? Number(row.value) : undefined;
    };
    const spread2Y10Y = findSpread("2Y", "10Y");
    const spread3M10Y = findSpread("3M", "10Y");
    return {
      date: payload?.date,
      points: normalized,
      spreads,
      spread2Y10Y,
      spread3M10Y,
      total: normalized.length,
    };
  }

  /**
   * Retrieves sovereign yield spreads (2Y-10Y, 3M-10Y curve steepness indicators).
   */
  public async getSpreads(options?: RequestOptions): Promise<any> {
    const raw = await this.transport.request<any>(
      "/api/v1/fixed-income/spreads",
      "GET",
      undefined,
      options
    );
    return raw?.data !== undefined ? raw.data : raw;
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
