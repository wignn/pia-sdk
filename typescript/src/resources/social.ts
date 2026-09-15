/**
 * Official PIA SDK - Social Intelligence API Resource
 */

import type { HttpTransport } from "../http/transport";
import type {
  GetSocialOptions,
  GetSocialPostsOptions,
  SocialFeedResponse,
  SocialPostsResponse,
} from "../types";

export class SocialResource {
  constructor(private readonly transport: HttpTransport) {}

  /**
   * Fetches the latest social sentiment posts from PostgreSQL / RSSHub ingestion pipeline.
   *
   * @param options Pagination limit, cursor, and optional symbol filter.
   */
  public async getPosts(options?: GetSocialPostsOptions): Promise<SocialPostsResponse> {
    const params = new URLSearchParams();
    if (options?.symbol) params.set("q", options.symbol.trim().toUpperCase());
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.cursor) params.set("before", options.cursor);
    if (options?.before) params.set("before", options.before);
    if (options?.platform) params.set("platform", options.platform);
    if (options?.account) params.set("account", options.account);
    if (options?.q) params.set("q", options.q);

    const query = params.toString() ? `?${params.toString()}` : "";
    return this.transport.request<SocialPostsResponse>(
      `/api/v1/social/posts${query}`,
      "GET",
      undefined,
      options
    );
  }

  /**
   * Fetches the real-time social discussion feed.
   */
  public async getFeed(options?: GetSocialOptions): Promise<SocialFeedResponse> {
    const params = new URLSearchParams();
    if (options?.symbol) params.set("symbol", options.symbol.trim().toUpperCase());
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.cursor) params.set("cursor", options.cursor);

    const query = params.toString() ? `?${params.toString()}` : "";
    return this.transport.request<SocialFeedResponse>(
      `/api/v1/social/feed${query}`,
      "GET",
      undefined,
      options
    );
  }
}
