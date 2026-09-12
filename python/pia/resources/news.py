"""Official PIA SDK - News Intelligence Resource."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from ..transport import AsyncTransport, SyncTransport
from ..types import NewsFeedResponse


class NewsResource:
    """Synchronous News API resource."""

    def __init__(self, transport: SyncTransport) -> None:
        self._transport = transport

    def get_news(
        self,
        *,
        symbols: Optional[List[str]] = None,
        category: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> NewsFeedResponse:
        """Fetches curated financial news articles with ticker entity tagging."""
        params: Dict[str, Any] = {}
        if symbols:
            params["symbols"] = ",".join(s.strip().upper() for s in symbols if s.strip())
        if category:
            params["category"] = category
        if limit is not None:
            params["limit"] = limit

        data = self._transport.request("/api/v1/news", method="GET", params=params)
        return NewsFeedResponse.from_dict(data)

    def get_latest(self) -> Dict[str, Any]:
        """Fetches latest breaking news."""
        return self._transport.request("/api/v1/news/latest", method="GET")

    def get_by_id(self, article_id: str) -> Dict[str, Any]:
        """Fetches specific news article by ID."""
        return self._transport.request(f"/api/v1/news/{article_id}", method="GET")


class AsyncNewsResource:
    """Asynchronous News API resource."""

    def __init__(self, transport: AsyncTransport) -> None:
        self._transport = transport

    async def get_news(
        self,
        *,
        symbols: Optional[List[str]] = None,
        category: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> NewsFeedResponse:
        """Fetches curated financial news articles with ticker entity tagging."""
        params: Dict[str, Any] = {}
        if symbols:
            params["symbols"] = ",".join(s.strip().upper() for s in symbols if s.strip())
        if category:
            params["category"] = category
        if limit is not None:
            params["limit"] = limit

        data = await self._transport.request("/api/v1/news", method="GET", params=params)
        return NewsFeedResponse.from_dict(data)

    async def get_latest(self) -> Dict[str, Any]:
        """Fetches latest breaking news."""
        return await self._transport.request("/api/v1/news/latest", method="GET")

    async def get_by_id(self, article_id: str) -> Dict[str, Any]:
        """Fetches specific news article by ID."""
        return await self._transport.request(f"/api/v1/news/{article_id}", method="GET")
