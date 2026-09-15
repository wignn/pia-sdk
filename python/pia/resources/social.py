"""Official PIA SDK - Social Intelligence Resource."""

from __future__ import annotations

from typing import Any, Dict, Optional

from ..transport import AsyncTransport, SyncTransport
from ..types import SocialFeedResponse, SocialPostsResponse


def _social_params(
    *,
    symbol: Optional[str] = None,
    limit: Optional[int] = None,
    cursor: Optional[str] = None,
    before: Optional[str] = None,
    platform: Optional[str] = None,
    account: Optional[str] = None,
    q: Optional[str] = None,
) -> Dict[str, Any]:
    params: Dict[str, Any] = {}
    if symbol:
        params["symbol"] = symbol.strip().upper()
        params["q"] = symbol.strip().upper()
    if q:
        params["q"] = q
    if platform:
        params["platform"] = platform
    if account:
        params["account"] = account
    if before:
        params["before"] = before
    elif cursor:
        params["before"] = cursor
    if limit is not None:
        params["limit"] = limit
    return params


class SocialResource:
    """Synchronous Social Sentiment & Discussions resource."""

    def __init__(self, transport: SyncTransport) -> None:
        self._transport = transport

    def get_posts(
        self,
        *,
        symbol: Optional[str] = None,
        limit: Optional[int] = None,
        cursor: Optional[str] = None,
        before: Optional[str] = None,
        platform: Optional[str] = None,
        account: Optional[str] = None,
        q: Optional[str] = None,
    ) -> SocialPostsResponse:
        """Fetches raw social posts using the backend's actual filters."""
        data = self._transport.request(
            "/api/v1/social/posts", method="GET",
            params=_social_params(symbol=symbol, limit=limit, cursor=cursor, before=before, platform=platform, account=account, q=q),
        )
        return SocialPostsResponse.from_dict(data)

    def get_feed(
        self,
        *,
        symbol: Optional[str] = None,
        limit: Optional[int] = None,
        cursor: Optional[str] = None,
    ) -> SocialFeedResponse:
        """Fetches curated social discussions and market sentiment posts."""
        data = self._transport.request(
            "/api/v1/social/feed", method="GET",
            params=_social_params(symbol=symbol, limit=limit, cursor=cursor),
        )
        return SocialFeedResponse.from_dict(data)


class AsyncSocialResource:
    """Asynchronous Social Sentiment & Discussions resource."""

    def __init__(self, transport: AsyncTransport) -> None:
        self._transport = transport

    async def get_posts(
        self,
        *,
        symbol: Optional[str] = None,
        limit: Optional[int] = None,
        cursor: Optional[str] = None,
        before: Optional[str] = None,
        platform: Optional[str] = None,
        account: Optional[str] = None,
        q: Optional[str] = None,
    ) -> SocialPostsResponse:
        """Asynchronously fetches raw social posts using the backend's actual filters."""
        data = await self._transport.request(
            "/api/v1/social/posts", method="GET",
            params=_social_params(symbol=symbol, limit=limit, cursor=cursor, before=before, platform=platform, account=account, q=q),
        )
        return SocialPostsResponse.from_dict(data)

    async def get_feed(
        self,
        *,
        symbol: Optional[str] = None,
        limit: Optional[int] = None,
        cursor: Optional[str] = None,
    ) -> SocialFeedResponse:
        """Asynchronously fetches curated social discussions and market sentiment posts."""
        data = await self._transport.request(
            "/api/v1/social/feed", method="GET",
            params=_social_params(symbol=symbol, limit=limit, cursor=cursor),
        )
        return SocialFeedResponse.from_dict(data)
