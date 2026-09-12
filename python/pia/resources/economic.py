"""Official PIA SDK - Economic Intelligence Resource."""

from __future__ import annotations

from typing import Any, Dict, Optional

from ..transport import AsyncTransport, SyncTransport


class EconomicResource:
    """Synchronous Economic API resource."""

    def __init__(self, transport: SyncTransport) -> None:
        self._transport = transport

    def get_calendar(
        self,
        *,
        impact: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Fetches global macroeconomic calendar events (NFP, CPI, interest rates)."""
        params: Dict[str, Any] = {}
        if impact:
            params["impact"] = impact
        if limit is not None:
            params["limit"] = limit

        return self._transport.request("/api/v1/economic/calendar", method="GET", params=params)

    def get_indicators(self) -> Dict[str, Any]:
        """Retrieves macroeconomic indicators and series metadata."""
        return self._transport.request("/api/v1/economic/indicators", method="GET")


class AsyncEconomicResource:
    """Asynchronous Economic API resource."""

    def __init__(self, transport: AsyncTransport) -> None:
        self._transport = transport

    async def get_calendar(
        self,
        *,
        impact: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Fetches global macroeconomic calendar events (NFP, CPI, interest rates)."""
        params: Dict[str, Any] = {}
        if impact:
            params["impact"] = impact
        if limit is not None:
            params["limit"] = limit

        return await self._transport.request("/api/v1/economic/calendar", method="GET", params=params)

    async def get_indicators(self) -> Dict[str, Any]:
        """Retrieves macroeconomic indicators and series metadata."""
        return await self._transport.request("/api/v1/economic/indicators", method="GET")
