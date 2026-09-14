"""Official PIA SDK - Derivatives & Options Analytics Resource."""

from __future__ import annotations

import urllib.parse
from typing import Any, Optional

from ..errors import ValidationError
from ..transport import AsyncTransport, SyncTransport
from ..types import OptionChainResponse, OptionGexResponse, OptionSummaryResponse


class OptionsResource:
    """Synchronous Options & Derivatives Analytics resource."""

    def __init__(self, transport: SyncTransport) -> None:
        self._transport = transport

    def get_chain(self, symbol: str) -> OptionChainResponse:
        """Fetches the real-time option chain for an underlying asset symbol."""
        if not symbol or not symbol.strip():
            raise ValidationError("Symbol must be a non-empty string.", param_name="symbol")
        clean = symbol.strip().upper()
        encoded = urllib.parse.quote(clean, safe="")
        data = self._transport.request(f"/api/v1/options/chain/{encoded}", method="GET")
        return OptionChainResponse.from_dict(data)

    def get_gex(self, symbol: str) -> OptionGexResponse:
        """Fetches Gamma Exposure (GEX) profile and zero-gamma inflection levels."""
        if not symbol or not symbol.strip():
            raise ValidationError("Symbol must be a non-empty string.", param_name="symbol")
        clean = symbol.strip().upper()
        encoded = urllib.parse.quote(clean, safe="")
        data = self._transport.request(f"/api/v1/options/gex/{encoded}", method="GET")
        return OptionGexResponse.from_dict(data)

    def get_summary(self) -> OptionSummaryResponse:
        """Retrieves overall options market activity and put/call sentiment summary."""
        data = self._transport.request("/api/v1/options/summary", method="GET")
        return OptionSummaryResponse.from_dict(data)


class AsyncOptionsResource:
    """Asynchronous Options & Derivatives Analytics resource."""

    def __init__(self, transport: AsyncTransport) -> None:
        self._transport = transport

    async def get_chain(self, symbol: str) -> OptionChainResponse:
        """Asynchronously fetches real-time option chain for an underlying asset symbol."""
        if not symbol or not symbol.strip():
            raise ValidationError("Symbol must be a non-empty string.", param_name="symbol")
        clean = symbol.strip().upper()
        encoded = urllib.parse.quote(clean, safe="")
        data = await self._transport.request(f"/api/v1/options/chain/{encoded}", method="GET")
        return OptionChainResponse.from_dict(data)

    async def get_gex(self, symbol: str) -> OptionGexResponse:
        """Asynchronously fetches Gamma Exposure (GEX) profile."""
        if not symbol or not symbol.strip():
            raise ValidationError("Symbol must be a non-empty string.", param_name="symbol")
        clean = symbol.strip().upper()
        encoded = urllib.parse.quote(clean, safe="")
        data = await self._transport.request(f"/api/v1/options/gex/{encoded}", method="GET")
        return OptionGexResponse.from_dict(data)

    async def get_summary(self) -> OptionSummaryResponse:
        """Asynchronously retrieves overall options market activity and put/call summary."""
        data = await self._transport.request("/api/v1/options/summary", method="GET")
        return OptionSummaryResponse.from_dict(data)
