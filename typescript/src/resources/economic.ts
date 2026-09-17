/**
 * Official PIA SDK - Economic Intelligence API Resource
 */

import type { HttpTransport } from "../http/transport";
import type {
  EconomicCalendarResponse,
  GetCalendarOptions,
  GetMacroMapOptions,
  MacroMapResponse,
  RequestOptions,
} from "../types";

export class EconomicResource {
  constructor(private readonly transport: HttpTransport) {}

  /**
   * Retrieves global Macro Maps choropleth data (Inflation, Unemployment, GDP, Policy Rates, PMI)
   * with sovereign rankings, historical timeline, and delta changes.
   */
  public async getMacroMap(options?: GetMacroMapOptions): Promise<MacroMapResponse> {
    const params = new URLSearchParams();
    if (options?.indicator) params.set("indicator", options.indicator);
    if (options?.period) params.set("period", options.period);

    const query = params.toString() ? `?${params.toString()}` : "";
    try {
      return await this.transport.request<any>(
        `/api/v1/macro/map${query}`,
        "GET",
        undefined,
        options
      );
    } catch {
      return await this.transport.request<any>(
        `/api/v1/economic/map${query}`,
        "GET",
        undefined,
        options
      );
    }
  }

  /**
   * Fetches global macroeconomic calendar events (NFP, CPI, interest rates, GDP).
   */
  public async getCalendar(options?: GetCalendarOptions): Promise<EconomicCalendarResponse> {
    const params = new URLSearchParams();
    if (options?.impact) params.set("impact", options.impact);
    if (options?.limit) params.set("limit", String(options.limit));

    const query = params.toString() ? `?${params.toString()}` : "";
    const raw = await this.transport.request<any>(
      "/api/v1/economic/calendar" + query,
      "GET",
      undefined,
      options
    );
    const events = raw?.events || raw?.items || raw?.data || [];
    return { ...raw, events: Array.isArray(events) ? events : [], items: Array.isArray(events) ? events : [], total: raw?.total ?? (Array.isArray(events) ? events.length : 0) };
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

  /**
   * Retrieves list of available macroeconomic indicator categories.
   */
  public async getCategories(options?: RequestOptions): Promise<any> {
    return this.transport.request<any>(
      "/api/v1/economic/categories",
      "GET",
      undefined,
      options
    );
  }

  /**
   * Retrieves list of supported sovereign countries for economic indicators.
   */
  public async getCountries(options?: RequestOptions): Promise<any> {
    return this.transport.request<any>(
      "/api/v1/economic/countries",
      "GET",
      undefined,
      options
    );
  }
}
