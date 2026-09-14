/**
 * Official PIA SDK - Energy Markets & Commodity Reserves Resource
 */

import type { HttpTransport } from "../http/transport";
import type { RequestOptions } from "../types";

export interface EnergyDashboardResponse {
  crude_oil?: {
    wti_price?: number;
    brent_price?: number;
    spread?: number;
    weekly_change_pct?: number;
  };
  natural_gas?: {
    henry_hub_price?: number;
    storage_bcf?: number;
    storage_change?: number;
  };
  refining_margins?: Record<string, number>;
  updated_at: string;
}

export interface EnergySeriesResponse {
  series_id: string;
  name: string;
  unit: string;
  data: Array<{
    date: string;
    value: number;
  }>;
}

export class EnergyResource {
  constructor(private readonly transport: HttpTransport) {}

  /**
   * Retrieves energy market dashboard including WTI/Brent crude prices, crack spreads, and storage.
   */
  public async getDashboard(options?: RequestOptions): Promise<EnergyDashboardResponse> {
    return this.transport.request<EnergyDashboardResponse>(
      "/api/v1/energy/dashboard",
      "GET",
      undefined,
      options
    );
  }

  /**
   * Retrieves historical time series data for a specific energy benchmark series.
   */
  public async getSeries(
    seriesId: string,
    options?: RequestOptions
  ): Promise<EnergySeriesResponse> {
    const params = new URLSearchParams();
    if (seriesId) params.set("id", seriesId);
    const query = params.toString() ? `?${params.toString()}` : "";
    return this.transport.request<EnergySeriesResponse>(
      `/api/v1/energy/series${query}`,
      "GET",
      undefined,
      options
    );
  }
}
