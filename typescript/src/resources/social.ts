/**
 * Official PIA SDK - Social Intelligence API Resource
 */

import type { HttpTransport } from "../http/transport";
import type { GetSocialOptions, SocialFeedResponse } from "../types";

export class SocialResource {
  constructor(private readonly transport: HttpTransport) {}

  /**
   * Fetches the latest social sentiment posts and discussions.
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

  /**
   * @deprecated Use `getFeed(options)` instead.
   */
  public async getPosts(options?: GetSocialOptions): Promise<SocialFeedResponse> {
    return this.getFeed(options);
  }
}
