/**
 * Official PIA SDK - News Intelligence API Resource
 */

import type { HttpTransport } from "../http/transport";
import type { GetNewsOptions, NewsFeedResponse, RequestOptions } from "../types";

export class NewsResource {
  constructor(private readonly transport: HttpTransport) {}

  /**
   * Fetches curated financial and macro news articles.
   */
  public async getNews(options?: GetNewsOptions): Promise<NewsFeedResponse> {
    const params = new URLSearchParams();
    if (options?.symbols && options.symbols.length > 0) {
      params.set("symbols", options.symbols.map((s) => s.trim().toUpperCase()).join(","));
    }
    if (options?.category) params.set("category", options.category);
    if (options?.limit) params.set("limit", String(options.limit));

    const query = params.toString() ? `?${params.toString()}` : "";
    return this.transport.request<NewsFeedResponse>(
      `/api/v1/news${query}`,
      "GET",
      undefined,
      options
    );
  }

  /**
   * Fetches the latest breaking financial news bulletin.
   */
  public async getLatest(options?: RequestOptions): Promise<any> {
    return this.transport.request<any>(
      "/api/v1/news/latest",
      "GET",
      undefined,
      options
    );
  }

  /**
   * Fetches detailed intelligence for a specific news article ID.
   */
  public async getById(id: string, options?: RequestOptions): Promise<any> {
    return this.transport.request<any>(
      `/api/v1/news/${encodeURIComponent(id)}`,
      "GET",
      undefined,
      options
    );
  }
}
