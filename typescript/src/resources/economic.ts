/**
 * Official PIA SDK - Economic Intelligence API Resource
 */

import type { HttpTransport } from "../http/transport";
import type { EconomicCalendarResponse, GetCalendarOptions, RequestOptions } from "../types";

export class EconomicResource {
  constructor(private readonly transport: HttpTransport) {}

  /**
   * Fetches global macroeconomic calendar events (NFP, CPI, interest rates, GDP).
   */
  public async getCalendar(options?: GetCalendarOptions): Promise<EconomicCalendarResponse> {
    const params = new URLSearchParams();
    if (options?.impact) params.set("impact", options.impact);
    if (options?.limit) params.set("limit", String(options.limit));

    const query = params.toString() ? `?${params.toString()}` : "";
    return this.transport.request<EconomicCalendarResponse>(
      `/api/v1/economic/calendar${query}`,
      "GET",
      undefined,
      options
    );
  }

  /**
   * Retrieves macroeconomic indicators and series metadata.
   */
  public async getIndicators(options?: RequestOptions): Promise<any> {
    return this.transport.request<any>(
      "/api/v1/economic/indicators",
      "GET",
      undefined,
      options
    );
  }
}
