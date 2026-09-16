/**
 * Official PIA SDK - SEC EDGAR Filings Resource
 */

import { ValidationError } from "../errors";
import type { HttpTransport } from "../http/transport";
import type { RequestOptions } from "../types";

export interface SecFilingItem {
  id: string;
  symbol: string;
  form_type: "10-K" | "10-Q" | "8-K" | "4" | "13F" | string;
  company_name: string;
  cik: string;
  filing_date: string;
  report_url: string;
  description?: string;
}

export interface SecFilingsResponse {
  total: number;
  items: SecFilingItem[];
  has_more?: boolean;
}

export interface GetSecFilingsOptions extends RequestOptions {
  symbol?: string;
  form_type?: string;
  limit?: number;
  since?: string;
}

export class SecResource {
  constructor(private readonly transport: HttpTransport) {}

  /**
   * Retrieves latest corporate SEC EDGAR filings (10-K, 10-Q, 8-K, Form 4 insider trades).
   */
  public async getFilings(options?: GetSecFilingsOptions): Promise<SecFilingsResponse> {
    const params = new URLSearchParams();
    if (options?.symbol) params.set("symbol", options.symbol.trim().toUpperCase());
    if (options?.form_type) params.set("form_type", options.form_type);
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.since) params.set("since", options.since);

    const query = params.toString() ? `?${params.toString()}` : "";
    const raw = await this.transport.request<any>(
      `/api/v1/sec/filings${query}`,
      "GET",
      undefined,
      options
    );
    const items = Array.isArray(raw) ? raw : raw?.items || raw?.filings || raw?.data || [];
    return { total: raw?.total ?? items.length, items: Array.isArray(items) ? items : [], has_more: raw?.has_more };
  }

  /**
   * Retrieves SEC filing history for a specific public company symbol.
   */
  public async getCompany(symbol: string, options?: RequestOptions): Promise<any> {
    if (!symbol || typeof symbol !== "string" || symbol.trim() === "") {
      throw new ValidationError("Symbol must be a non-empty string.", "symbol");
    }
    const cleanSymbol = symbol.trim().toUpperCase();
    return this.transport.request<any>(
      `/api/v1/sec/companies/${encodeURIComponent(cleanSymbol)}`,
      "GET",
      undefined,
      options
    );
  }
}
