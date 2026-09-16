/**
 * Official PIA SDK - Geopolitical Signals & Macro Conflict Map Resource
 */

import type { HttpTransport } from "../http/transport";
import type { RequestOptions } from "../types";

export interface GeoSignalEvent {
  id: string;
  title: string;
  region: string;
  severity: "low" | "medium" | "high" | "critical";
  category: "conflict" | "sanction" | "trade" | "election" | "supply_chain";
  latitude?: number;
  longitude?: number;
  impacted_assets?: string[];
  summary: string;
  published_at: string;
}

export interface GeoSignalsResponse {
  total: number;
  events?: GeoSignalEvent[];
  items?: GeoSignalEvent[];
}

export interface GeoSignalsMapResponse {
  layers: Array<{
    region: string;
    risk_level: number;
    active_conflicts: number;
    chokepoints_status?: Record<string, string>;
  }>;
}

export interface GeoSignalsAssetImpactResponse {
  assets: Array<{
    symbol: string;
    risk_score: number;
    primary_risk_driver: string;
    affected_supply_pct?: number;
  }>;
}

export class GeosignalsResource {
  constructor(private readonly transport: HttpTransport) {}

  /**
   * Retrieves active geopolitical risk events and conflict alerts.
   */
  public async getEvents(options?: RequestOptions): Promise<GeoSignalsResponse> {
    const raw = await this.transport.request<any>(
      "/api/v1/geosignals",
      "GET",
      undefined,
      options
    );
    return {
      ...raw,
      total: raw?.total ?? (raw?.items || []).length,
      items: raw?.items || raw?.events || [],
      events: raw?.events || raw?.items || [],
    };
  }

  /**
   * Retrieves global geopolitical risk map layer data and maritime chokepoints status.
   */
  public async getMap(options?: RequestOptions): Promise<GeoSignalsMapResponse> {
    return this.transport.request<GeoSignalsMapResponse>(
      "/api/v1/geosignals/map",
      "GET",
      undefined,
      options
    );
  }

  /**
   * Retrieves mapped asset vulnerabilities and commodity exposure to current geopolitical tensions.
   */
  public async getAssetImpacts(options?: RequestOptions): Promise<GeoSignalsAssetImpactResponse> {
    return this.transport.request<GeoSignalsAssetImpactResponse>(
      "/api/v1/geosignals/assets",
      "GET",
      undefined,
      options
    );
  }
}
