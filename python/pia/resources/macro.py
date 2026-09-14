"""Official PIA SDK - Macro & Market Sentiment Resource."""

from __future__ import annotations

import urllib.parse
from typing import Any, Optional

from ..errors import ValidationError
from ..transport import AsyncTransport, SyncTransport
from ..types import (
    CentralBankStanceResponse,
    CotReportResponse,
    FearGreedData,
    FearGreedHistoryResponse,
)


class MacroResource:
    """Synchronous Macro, Sentiment & Positioning resource."""

    def __init__(self, transport: SyncTransport) -> None:
        self._transport = transport

    def get_fear_greed(self) -> FearGreedData:
        """Retrieves current Fear & Greed Index score and sentiment rating."""
        data = self._transport.request("/api/v1/fear-greed", method="GET")
        return FearGreedData.from_dict(data)

    def get_fear_greed_history(self) -> FearGreedHistoryResponse:
        """Retrieves historical Fear & Greed Index time series."""
        data = self._transport.request("/api/v1/fear-greed/history", method="GET")
        return FearGreedHistoryResponse.from_dict(data)

    def get_cot(self, symbol: str) -> CotReportResponse:
        """Fetches CFTC Commitment of Traders (COT) positioning report for a symbol."""
        if not symbol or not symbol.strip():
            raise ValidationError("Symbol must be a non-empty string.", param_name="symbol")
        clean = symbol.strip().upper()
        encoded = urllib.parse.quote(clean, safe="")
        data = self._transport.request(f"/api/v1/cot/symbol/{encoded}", method="GET")
        return CotReportResponse.from_dict(data)

    def get_central_bank_stance(self, bank: str) -> CentralBankStanceResponse:
        """Fetches policy stance and interest rate assessment for a central bank."""
        if not bank or not bank.strip():
            raise ValidationError("Bank must be a non-empty string.", param_name="bank")
        clean = bank.strip().lower()
        encoded = urllib.parse.quote(clean, safe="")
        data = self._transport.request(f"/api/v1/central-banks/{encoded}/stance", method="GET")
        return CentralBankStanceResponse.from_dict(data)


class AsyncMacroResource:
    """Asynchronous Macro, Sentiment & Positioning resource."""

    def __init__(self, transport: AsyncTransport) -> None:
        self._transport = transport

    async def get_fear_greed(self) -> FearGreedData:
        """Asynchronously retrieves current Fear & Greed Index score."""
        data = await self._transport.request("/api/v1/fear-greed", method="GET")
        return FearGreedData.from_dict(data)

    async def get_fear_greed_history(self) -> FearGreedHistoryResponse:
        """Asynchronously retrieves historical Fear & Greed Index time series."""
        data = await self._transport.request("/api/v1/fear-greed/history", method="GET")
        return FearGreedHistoryResponse.from_dict(data)

    async def get_cot(self, symbol: str) -> CotReportResponse:
        """Asynchronously fetches CFTC Commitment of Traders (COT) positioning."""
        if not symbol or not symbol.strip():
            raise ValidationError("Symbol must be a non-empty string.", param_name="symbol")
        clean = symbol.strip().upper()
        encoded = urllib.parse.quote(clean, safe="")
        data = await self._transport.request(f"/api/v1/cot/symbol/{encoded}", method="GET")
        return CotReportResponse.from_dict(data)

    async def get_central_bank_stance(self, bank: str) -> CentralBankStanceResponse:
        """Asynchronously fetches monetary policy stance for a central bank."""
        if not bank or not bank.strip():
            raise ValidationError("Bank must be a non-empty string.", param_name="bank")
        clean = bank.strip().lower()
        encoded = urllib.parse.quote(clean, safe="")
        data = await self._transport.request(f"/api/v1/central-banks/{encoded}/stance", method="GET")
        return CentralBankStanceResponse.from_dict(data)
