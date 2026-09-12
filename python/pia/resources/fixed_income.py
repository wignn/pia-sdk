"""Official PIA SDK - Fixed Income & Sovereign Rates Resource."""

from __future__ import annotations

from typing import Any, Dict

from ..transport import AsyncTransport, SyncTransport


class FixedIncomeResource:
    """Synchronous Fixed Income API resource."""

    def __init__(self, transport: SyncTransport) -> None:
        self._transport = transport

    def get_yield_curve(self) -> Dict[str, Any]:
        """Retrieves US Treasury sovereign bond yield curve structure."""
        return self._transport.request("/api/v1/fixed-income/yield-curve", method="GET")

    def get_spreads(self) -> Dict[str, Any]:
        """Retrieves sovereign yield spreads (2Y-10Y, 3M-10Y)."""
        return self._transport.request("/api/v1/fixed-income/spreads", method="GET")


class AsyncFixedIncomeResource:
    """Asynchronous Fixed Income API resource."""

    def __init__(self, transport: AsyncTransport) -> None:
        self._transport = transport

    async def get_yield_curve(self) -> Dict[str, Any]:
        """Retrieves US Treasury sovereign bond yield curve structure."""
        return await self._transport.request("/api/v1/fixed-income/yield-curve", method="GET")

    async def get_spreads(self) -> Dict[str, Any]:
        """Retrieves sovereign yield spreads (2Y-10Y, 3M-10Y)."""
        return await self._transport.request("/api/v1/fixed-income/spreads", method="GET")
