"""Official PIA SDK - SEC EDGAR Filings Resource."""

from __future__ import annotations

import urllib.parse
from typing import Any, Dict, Optional

from ..errors import ValidationError
from ..transport import AsyncTransport, SyncTransport


class SecResource:
    """Synchronous SEC EDGAR Corporate Filings resource."""

    def __init__(self, transport: SyncTransport) -> None:
        self._transport = transport

    def get_filings(
        self,
        symbol: Optional[str] = None,
        form_type: Optional[str] = None,
        limit: Optional[int] = None,
        since: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Retrieves corporate SEC filings (10-K, 10-Q, 8-K, Form 4 insider transactions)."""
        params: Dict[str, Any] = {}
        if symbol:
            params["symbol"] = symbol.strip().upper()
        if form_type:
            params["form_type"] = form_type
        if limit is not None:
            params["limit"] = limit
        if since:
            params["since"] = since
        return self._transport.request("/api/v1/sec/filings", method="GET", params=params)

    def get_company(self, symbol: str) -> Dict[str, Any]:
        """Retrieves SEC profile and historical filings for a company symbol."""
        if not symbol or not symbol.strip():
            raise ValidationError("Symbol must be a non-empty string.", param_name="symbol")
        clean = symbol.strip().upper()
        encoded = urllib.parse.quote(clean, safe="")
        return self._transport.request(f"/api/v1/sec/companies/{encoded}", method="GET")


class AsyncSecResource:
    """Asynchronous SEC EDGAR Corporate Filings resource."""

    def __init__(self, transport: AsyncTransport) -> None:
        self._transport = transport

    async def get_filings(
        self,
        symbol: Optional[str] = None,
        form_type: Optional[str] = None,
        limit: Optional[int] = None,
        since: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Asynchronously retrieves corporate SEC filings."""
        params: Dict[str, Any] = {}
        if symbol:
            params["symbol"] = symbol.strip().upper()
        if form_type:
            params["form_type"] = form_type
        if limit is not None:
            params["limit"] = limit
        if since:
            params["since"] = since
        return await self._transport.request("/api/v1/sec/filings", method="GET", params=params)

    async def get_company(self, symbol: str) -> Dict[str, Any]:
        """Asynchronously retrieves SEC profile for a company symbol."""
        if not symbol or not symbol.strip():
            raise ValidationError("Symbol must be a non-empty string.", param_name="symbol")
        clean = symbol.strip().upper()
        encoded = urllib.parse.quote(clean, safe="")
        return await self._transport.request(f"/api/v1/sec/companies/{encoded}", method="GET")
