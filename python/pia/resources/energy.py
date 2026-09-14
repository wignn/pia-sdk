"""Official PIA SDK - Energy Markets & Commodity Reserves Resource."""

from __future__ import annotations

from typing import Any, Dict, Optional

from ..transport import AsyncTransport, SyncTransport


class EnergyResource:
    """Synchronous Energy Markets resource."""

    def __init__(self, transport: SyncTransport) -> None:
        self._transport = transport

    def get_dashboard(self) -> Dict[str, Any]:
        """Retrieves energy market overview including crude oil benchmarks, spreads, and gas storage."""
        return self._transport.request("/api/v1/energy/dashboard", method="GET")

    def get_series(self, series_id: str) -> Dict[str, Any]:
        """Retrieves historical time series data for an energy series ID."""
        params: Dict[str, Any] = {}
        if series_id:
            params["id"] = series_id
        return self._transport.request("/api/v1/energy/series", method="GET", params=params)


class AsyncEnergyResource:
    """Asynchronous Energy Markets resource."""

    def __init__(self, transport: AsyncTransport) -> None:
        self._transport = transport

    async def get_dashboard(self) -> Dict[str, Any]:
        """Asynchronously retrieves energy market overview."""
        return await self._transport.request("/api/v1/energy/dashboard", method="GET")

    async def get_series(self, series_id: str) -> Dict[str, Any]:
        """Asynchronously retrieves historical time series data for an energy series ID."""
        params: Dict[str, Any] = {}
        if series_id:
            params["id"] = series_id
        return await self._transport.request("/api/v1/energy/series", method="GET", params=params)
