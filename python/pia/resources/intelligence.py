"""Official PIA SDK - AI Intelligence & Market Analysis Resource."""

from __future__ import annotations

import urllib.parse
from typing import Any, Dict, List, Optional

from ..errors import ValidationError
from ..transport import AsyncTransport, SyncTransport


class IntelligenceResource:
    """Synchronous AI Market Intelligence & Quantitative Analysis resource."""

    def __init__(self, transport: SyncTransport) -> None:
        self._transport = transport

    def analyze(
        self,
        symbol: Optional[str] = None,
        query: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Generates AI-powered real-time quantitative analysis and catalyst explanations."""
        payload: Dict[str, Any] = {}
        if symbol:
            payload["symbol"] = symbol.strip().upper()
        if query:
            payload["query"] = query
        if context:
            payload["context"] = context
        return self._transport.request("/api/v1/intelligence/analyze", method="POST", json_data=payload)

    def get_insights(self, symbol: str) -> Dict[str, Any]:
        """Retrieves synthesized AI narrative insights and price drivers for a specific symbol."""
        if not symbol or not symbol.strip():
            raise ValidationError("Symbol must be a non-empty string.", param_name="symbol")
        clean = symbol.strip().upper()
        encoded = urllib.parse.quote(clean, safe="")
        return self._transport.request(f"/api/v1/market/insights/{encoded}", method="GET")


class AsyncIntelligenceResource:
    """Asynchronous AI Market Intelligence & Quantitative Analysis resource."""

    def __init__(self, transport: AsyncTransport) -> None:
        self._transport = transport

    async def analyze(
        self,
        symbol: Optional[str] = None,
        query: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Asynchronously generates AI-powered quantitative analysis."""
        payload: Dict[str, Any] = {}
        if symbol:
            payload["symbol"] = symbol.strip().upper()
        if query:
            payload["query"] = query
        if context:
            payload["context"] = context
        return await self._transport.request("/api/v1/intelligence/analyze", method="POST", json_data=payload)

    async def get_insights(self, symbol: str) -> Dict[str, Any]:
        """Asynchronously retrieves synthesized AI narrative insights for a specific symbol."""
        if not symbol or not symbol.strip():
            raise ValidationError("Symbol must be a non-empty string.", param_name="symbol")
        clean = symbol.strip().upper()
        encoded = urllib.parse.quote(clean, safe="")
        return await self._transport.request(f"/api/v1/market/insights/{encoded}", method="GET")
