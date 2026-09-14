"""Official PIA SDK - Geopolitical Signals & Macro Conflict Map Resource."""

from __future__ import annotations

from typing import Any, Dict, Optional

from ..transport import AsyncTransport, SyncTransport


class GeosignalsResource:
    """Synchronous Geopolitical Signals & Risk Intelligence resource."""

    def __init__(self, transport: SyncTransport) -> None:
        self._transport = transport

    def get_events(self) -> Dict[str, Any]:
        """Retrieves active geopolitical risk events and conflict alerts."""
        return self._transport.request("/api/v1/geosignals", method="GET")

    def get_map(self) -> Dict[str, Any]:
        """Retrieves global geopolitical risk map layer data and maritime chokepoints."""
        return self._transport.request("/api/v1/geosignals/map", method="GET")

    def get_asset_impacts(self) -> Dict[str, Any]:
        """Retrieves mapped asset vulnerabilities to current geopolitical tensions."""
        return self._transport.request("/api/v1/geosignals/assets", method="GET")


class AsyncGeosignalsResource:
    """Asynchronous Geopolitical Signals & Risk Intelligence resource."""

    def __init__(self, transport: AsyncTransport) -> None:
        self._transport = transport

    async def get_events(self) -> Dict[str, Any]:
        """Asynchronously retrieves active geopolitical risk events."""
        return await self._transport.request("/api/v1/geosignals", method="GET")

    async def get_map(self) -> Dict[str, Any]:
        """Asynchronously retrieves global geopolitical risk map layer data."""
        return await self._transport.request("/api/v1/geosignals/map", method="GET")

    async def get_asset_impacts(self) -> Dict[str, Any]:
        """Asynchronously retrieves mapped asset vulnerabilities to geopolitical tensions."""
        return await self._transport.request("/api/v1/geosignals/assets", method="GET")
