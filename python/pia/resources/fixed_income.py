"""Official PIA SDK - Fixed Income & Sovereign Rates Resource."""

from __future__ import annotations

from typing import Any, Dict, Optional

from ..transport import AsyncTransport, SyncTransport


class FixedIncomeResource:
    """Synchronous Fixed Income API resource."""

    def __init__(self, transport: SyncTransport) -> None:
        self._transport = transport

    def get_yield_curve(self) -> Dict[str, Any]:
        return self._transport.request("/api/v1/fixed-income/yield-curve", method="GET")

    def get_spreads(self) -> Dict[str, Any]:
        return self._transport.request("/api/v1/fixed-income/spreads", method="GET")

    def get_rate(self, tenor: str) -> Dict[str, Any]:
        """Retrieves the current sovereign rate for a tenor such as 2Y or 10Y."""
        return self._transport.request(f"/api/v1/fixed-income/rates/{tenor.strip().upper()}", method="GET")


class AsyncFixedIncomeResource:
    """Asynchronous Fixed Income API resource."""

    def __init__(self, transport: AsyncTransport) -> None:
        self._transport = transport

    async def get_yield_curve(self) -> Dict[str, Any]:
        return await self._transport.request("/api/v1/fixed-income/yield-curve", method="GET")

    async def get_spreads(self) -> Dict[str, Any]:
        return await self._transport.request("/api/v1/fixed-income/spreads", method="GET")

    async def get_rate(self, tenor: str) -> Dict[str, Any]:
        return await self._transport.request(f"/api/v1/fixed-income/rates/{tenor.strip().upper()}", method="GET")
