"""Official PIA SDK - Strongly Typed Data Models."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class RateLimitInfo:
    """Telemetry information parsed from RFC 6585 and daily quota headers."""

    limit: Optional[int] = None
    remaining: Optional[int] = None
    reset_seconds: Optional[int] = None
    daily_limit: Optional[int] = None
    daily_remaining: Optional[int] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class MarketPrice:
    """Snapshot of a financial instrument's current market price and 24h stats."""

    symbol: str
    price: float
    bid: float
    ask: float
    high_24h: Optional[float] = None
    low_24h: Optional[float] = None
    change_24h_pct: Optional[float] = None
    volume_24h: Optional[float] = None
    asset_type: Optional[str] = None
    session_open: Optional[bool] = None
    timestamp: Optional[int] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> MarketPrice:
        p_raw = data.get("price")
        price = float(p_raw) if p_raw is not None else 0.0

        b_raw = data.get("bid")
        bid = float(b_raw) if b_raw is not None else price

        a_raw = data.get("ask")
        ask = float(a_raw) if a_raw is not None else price

        def _float_or_none(val: Any) -> Optional[float]:
            if val is None:
                return None
            try:
                return float(val)
            except (ValueError, TypeError):
                return None

        def _int_or_none(val: Any) -> Optional[int]:
            if val is None:
                return None
            try:
                return int(val)
            except (ValueError, TypeError):
                return None

        return cls(
            symbol=str(data.get("symbol", "")).upper(),
            price=price,
            bid=bid,
            ask=ask,
            high_24h=_float_or_none(data.get("high_24h")),
            low_24h=_float_or_none(data.get("low_24h")),
            change_24h_pct=_float_or_none(data.get("change_24h_pct")),
            volume_24h=_float_or_none(data.get("volume_24h")),
            asset_type=data.get("asset_type"),
            session_open=data.get("session_open"),
            timestamp=_int_or_none(data.get("timestamp")),
        )

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class MarketPricesResponse:
    total: int
    timestamp: int
    items: List[MarketPrice] = field(default_factory=list)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> MarketPricesResponse:
        raw_items = data.get("items") or []
        items = [MarketPrice.from_dict(item) for item in raw_items]
        return cls(
            total=int(data.get("total", len(items))),
            timestamp=int(data.get("timestamp", 0)),
            items=items,
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "total": self.total,
            "timestamp": self.timestamp,
            "items": [item.to_dict() for item in self.items],
        }


@dataclass
class SymbolItem:
    symbol: str
    asset_type: str
    exchange: str
    source: str
    price_precision: int = 2
    tick_size: float = 0.01
    is_active: bool = True
    name: Optional[str] = None
    last_price: Optional[float] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> SymbolItem:
        return cls(
            symbol=str(data.get("symbol", "")).upper(),
            asset_type=str(data.get("asset_type", "")),
            exchange=str(data.get("exchange", "")),
            source=str(data.get("source", "")),
            price_precision=int(data.get("price_precision", 2)),
            tick_size=float(data.get("tick_size", 0.01)),
            is_active=bool(data.get("is_active", True)),
            name=data.get("name"),
            last_price=float(data["last_price"]) if data.get("last_price") is not None else None,
        )

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class SymbolsResponse:
    total: int
    items: List[SymbolItem] = field(default_factory=list)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> SymbolsResponse:
        raw_items = data.get("items") or []
        items = [SymbolItem.from_dict(item) for item in raw_items if isinstance(item, dict)]
        return cls(
            total=int(data.get("total", len(items))),
            items=items,
        )

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class EconomicEvent:
    id: str
    title: str
    country: str
    impact: str
    date: str
    actual: Optional[float] = None
    forecast: Optional[float] = None
    previous: Optional[float] = None
    currency: Optional[str] = None
    time: Optional[str] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> EconomicEvent:
        return cls(
            id=str(data.get("id", data.get("event_id", ""))),
            title=str(data.get("title", data.get("event", ""))),
            country=str(data.get("country", "")),
            impact=str(data.get("impact", "")),
            date=str(data.get("date", "")),
            actual=float(data["actual"]) if data.get("actual") not in (None, "") else None,
            forecast=float(data["forecast"]) if data.get("forecast") not in (None, "") else None,
            previous=float(data["previous"]) if data.get("previous") not in (None, "") else None,
            currency=data.get("currency"),
            time=data.get("time"),
        )

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class EconomicCalendarResponse:
    total: int
    events: List[EconomicEvent] = field(default_factory=list)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> EconomicCalendarResponse:
        raw = data.get("events") or data.get("items") or []
        events = [EconomicEvent.from_dict(e) for e in raw if isinstance(e, dict)]
        return cls(
            total=int(data.get("total", len(events))),
            events=events,
        )

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class MacroMapCountryItem:
    country_code: str
    country_name: str
    value: float
    rank: int
    previous_value: Optional[float] = None
    change: Optional[float] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> MacroMapCountryItem:
        return cls(
            country_code=str(data.get("country_code", "")),
            country_name=str(data.get("country_name", "")),
            value=float(data.get("value", 0.0)),
            rank=int(data.get("rank", 0)),
            previous_value=float(data["previous_value"]) if data.get("previous_value") is not None else None,
            change=float(data["change"]) if data.get("change") is not None else None,
        )

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class MacroMapResponse:
    indicator: str
    indicator_name: str
    unit: str
    period: str
    min_value: float
    max_value: float
    total: int
    timeline: List[str] = field(default_factory=list)
    countries: List[MacroMapCountryItem] = field(default_factory=list)
    source: Optional[str] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> MacroMapResponse:
        raw_c = data.get("countries") or []
        countries = [MacroMapCountryItem.from_dict(c) for c in raw_c if isinstance(c, dict)]
        return cls(
            indicator=str(data.get("indicator", "")),
            indicator_name=str(data.get("indicator_name", "")),
            unit=str(data.get("unit", "")),
            period=str(data.get("period", "")),
            min_value=float(data.get("min_value", 0.0)),
            max_value=float(data.get("max_value", 100.0)),
            total=int(data.get("total", len(countries))),
            timeline=[str(t) for t in data.get("timeline", [])],
            countries=countries,
            source=data.get("source"),
        )

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class Candle:
    """OHLCV historical bar."""

    time: int
    open: float
    high: float
    low: float
    close: float
    volume: float

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> Candle:
        return cls(
            time=int(data.get("time", 0)),
            open=float(data.get("open", 0.0)),
            high=float(data.get("high", 0.0)),
            low=float(data.get("low", 0.0)),
            close=float(data.get("close", 0.0)),
            volume=float(data.get("volume", 0.0)),
        )

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class CandleResponse:
    symbol: str
    timeframe: str
    count: int
    candles: List[Candle] = field(default_factory=list)
    has_more: Optional[bool] = None
    next_before: Optional[int] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any], symbol: str = "", timeframe: str = "") -> CandleResponse:
        raw_candles = data.get("candles") or data.get("items") or []
        candles = [Candle.from_dict(c) for c in raw_candles]
        return cls(
            symbol=str(data.get("symbol") or symbol),
            timeframe=str(data.get("timeframe") or data.get("resolution") or timeframe),
            count=len(candles),
            candles=candles,
            has_more=data.get("has_more"),
            next_before=data.get("next_before"),
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "symbol": self.symbol,
            "timeframe": self.timeframe,
            "count": self.count,
            "candles": [c.to_dict() for c in self.candles],
            "has_more": self.has_more,
            "next_before": self.next_before,
        }


@dataclass
class OrderBookLevel:
    price: float
    size: float

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> OrderBookLevel:
        return cls(
            price=float(data.get("price", 0.0)),
            size=float(data.get("size", 0.0)),
        )


@dataclass
class OrderBook:
    symbol: str
    bids: List[OrderBookLevel] = field(default_factory=list)
    asks: List[OrderBookLevel] = field(default_factory=list)
    timestamp: int = 0

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> OrderBook:
        bids = [OrderBookLevel.from_dict(b) for b in (data.get("bids") or [])]
        asks = [OrderBookLevel.from_dict(a) for a in (data.get("asks") or [])]
        return cls(
            symbol=str(data.get("symbol", "")),
            bids=bids,
            asks=asks,
            timestamp=int(data.get("timestamp", 0)),
        )


@dataclass
class SocialPost:
    id: str
    author: str
    author_handle: str
    content: str
    posted_at: str
    media_urls: List[str] = field(default_factory=list)
    sentiment: Optional[str] = None
    symbols: List[str] = field(default_factory=list)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> SocialPost:
        return cls(
            id=str(data.get("id", "")),
            author=str(data.get("author", "")),
            author_handle=str(data.get("author_handle", "")),
            content=str(data.get("content", "")),
            posted_at=str(data.get("posted_at", "")),
            media_urls=data.get("media_urls") or [],
            sentiment=data.get("sentiment"),
            symbols=data.get("symbols") or [],
        )


@dataclass
class SocialFeedResponse:
    total: int
    posts: List[SocialPost] = field(default_factory=list)
    cursor: Optional[str] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> SocialFeedResponse:
        posts = [SocialPost.from_dict(p) for p in (data.get("posts") or [])]
        return cls(
            total=int(data.get("total", len(posts))),
            posts=posts,
            cursor=data.get("cursor"),
        )


@dataclass
class NewsArticle:
    id: str
    title: str
    summary: str
    url: str
    source: str
    published_at: str
    symbols: List[str] = field(default_factory=list)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> NewsArticle:
        return cls(
            id=str(data.get("id", "")),
            title=str(data.get("title", "")),
            summary=str(data.get("summary", "")),
            url=str(data.get("url", "")),
            source=str(data.get("source", "")),
            published_at=str(data.get("published_at", "")),
            symbols=data.get("symbols") or [],
        )


@dataclass
class NewsFeedResponse:
    total: int
    items: List[NewsArticle] = field(default_factory=list)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> NewsFeedResponse:
        items = [NewsArticle.from_dict(i) for i in (data.get("items") or [])]
        return cls(
            total=int(data.get("total", len(items))),
            items=items,
        )


@dataclass
class WsTicketResponse:
    ticket: str
    expires_in: Optional[int] = None
    ws_url: Optional[str] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> WsTicketResponse:
        return cls(
            ticket=str(data.get("ticket", "")),
            expires_in=data.get("expires_in"),
            ws_url=data.get("ws_url"),
        )


@dataclass
class SocialPostItem:
    author_username: str
    text: str
    url: str
    created_at: str
    platform: str = "twitter"
    author_display_name: Optional[str] = None
    like_count: int = 0
    retweet_count: int = 0
    media_urls: List[str] = field(default_factory=list)
    source_account: Optional[str] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> SocialPostItem:
        return cls(
            author_username=str(data.get("author_username", "")),
            text=str(data.get("text", "")),
            url=str(data.get("url", "")),
            created_at=str(data.get("created_at", "")),
            platform=str(data.get("platform", "twitter")),
            author_display_name=data.get("author_display_name"),
            like_count=int(data.get("like_count", 0) or 0),
            retweet_count=int(data.get("retweet_count", 0) or 0),
            media_urls=data.get("media_urls") or [],
            source_account=data.get("source_account"),
        )


@dataclass
class SocialPostsResponse:
    has_more: bool
    items: List[SocialPostItem] = field(default_factory=list)
    next_before: Optional[str] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> SocialPostsResponse:
        raw_items = data.get("items") or []
        items = [SocialPostItem.from_dict(it) for it in raw_items]
        return cls(
            has_more=bool(data.get("has_more", False)),
            items=items,
            next_before=data.get("next_before"),
        )


@dataclass
class OptionContract:
    symbol: str
    strike: float
    expiration: str
    option_type: str
    bid: Optional[float] = None
    ask: Optional[float] = None
    last: Optional[float] = None
    volume: Optional[int] = None
    open_interest: Optional[int] = None
    implied_volatility: Optional[float] = None
    delta: Optional[float] = None
    gamma: Optional[float] = None
    theta: Optional[float] = None
    vega: Optional[float] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> OptionContract:
        def _flt(k: str) -> Optional[float]:
            v = data.get(k)
            return float(v) if v is not None else None

        def _int(k: str) -> Optional[int]:
            v = data.get(k)
            return int(v) if v is not None else None

        return cls(
            symbol=str(data.get("symbol", "")),
            strike=float(data.get("strike", 0.0) or 0.0),
            expiration=str(data.get("expiration", "")),
            option_type=str(data.get("option_type", "")),
            bid=_flt("bid"),
            ask=_flt("ask"),
            last=_flt("last"),
            volume=_int("volume"),
            open_interest=_int("open_interest"),
            implied_volatility=_flt("implied_volatility"),
            delta=_flt("delta"),
            gamma=_flt("gamma"),
            theta=_flt("theta"),
            vega=_flt("vega"),
        )


@dataclass
class OptionChainResponse:
    symbol: str
    expirations: List[str] = field(default_factory=list)
    contracts: List[OptionContract] = field(default_factory=list)
    underlying_price: Optional[float] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> OptionChainResponse:
        raw_c = data.get("contracts") or []
        contracts = [OptionContract.from_dict(c) for c in raw_c]
        u_price = data.get("underlying_price")
        return cls(
            symbol=str(data.get("symbol", "")).upper(),
            expirations=data.get("expirations") or [],
            contracts=contracts,
            underlying_price=float(u_price) if u_price is not None else None,
        )


@dataclass
class OptionGexResponse:
    symbol: str
    net_gex: Optional[float] = None
    total_call_gex: Optional[float] = None
    total_put_gex: Optional[float] = None
    zero_gamma_level: Optional[float] = None
    major_positive_levels: List[Dict[str, Any]] = field(default_factory=list)
    major_negative_levels: List[Dict[str, Any]] = field(default_factory=list)
    updated_at: Optional[str] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> OptionGexResponse:
        def _flt(k: str) -> Optional[float]:
            v = data.get(k)
            return float(v) if v is not None else None

        return cls(
            symbol=str(data.get("symbol", "")).upper(),
            net_gex=_flt("net_gex"),
            total_call_gex=_flt("total_call_gex"),
            total_put_gex=_flt("total_put_gex"),
            zero_gamma_level=_flt("zero_gamma_level"),
            major_positive_levels=data.get("major_positive_levels") or [],
            major_negative_levels=data.get("major_negative_levels") or [],
            updated_at=data.get("updated_at"),
        )


@dataclass
class OptionSummaryResponse:
    total_volume: Optional[int] = None
    total_open_interest: Optional[int] = None
    put_call_ratio: Optional[float] = None
    most_active_symbols: List[Dict[str, Any]] = field(default_factory=list)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> OptionSummaryResponse:
        pcr = data.get("put_call_ratio")
        vol = data.get("total_volume")
        oi = data.get("total_open_interest")
        return cls(
            total_volume=int(vol) if vol is not None else None,
            total_open_interest=int(oi) if oi is not None else None,
            put_call_ratio=float(pcr) if pcr is not None else None,
            most_active_symbols=data.get("most_active_symbols") or [],
        )


@dataclass
class FearGreedData:
    score: float
    rating: str
    timestamp: Any
    previous_close: Optional[float] = None
    previous_1_week: Optional[float] = None
    previous_1_month: Optional[float] = None
    previous_1_year: Optional[float] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> FearGreedData:
        def _flt(k: str) -> Optional[float]:
            v = data.get(k)
            return float(v) if v is not None else None

        return cls(
            score=float(data.get("score", 0.0) or 0.0),
            rating=str(data.get("rating", "")),
            timestamp=data.get("timestamp"),
            previous_close=_flt("previous_close"),
            previous_1_week=_flt("previous_1_week"),
            previous_1_month=_flt("previous_1_month"),
            previous_1_year=_flt("previous_1_year"),
        )


@dataclass
class FearGreedHistoryResponse:
    current: FearGreedData
    history: List[Dict[str, Any]] = field(default_factory=list)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> FearGreedHistoryResponse:
        current_data = data.get("current") or data
        return cls(
            current=FearGreedData.from_dict(current_data),
            history=data.get("history") or [],
        )


@dataclass
class CotPositioning:
    market_code: str
    report_date: str
    market_name: Optional[str] = None
    commercial_long: Optional[int] = None
    commercial_short: Optional[int] = None
    non_commercial_long: Optional[int] = None
    non_commercial_short: Optional[int] = None
    net_position: Optional[int] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> CotPositioning:
        def _int(k: str) -> Optional[int]:
            v = data.get(k)
            return int(v) if v is not None else None

        return cls(
            market_code=str(data.get("market_code", "")),
            report_date=str(data.get("report_date", "")),
            market_name=data.get("market_name"),
            commercial_long=_int("commercial_long"),
            commercial_short=_int("commercial_short"),
            non_commercial_long=_int("non_commercial_long"),
            non_commercial_short=_int("non_commercial_short"),
            net_position=_int("net_position"),
        )


@dataclass
class CotReportResponse:
    reports: List[CotPositioning] = field(default_factory=list)
    symbol: Optional[str] = None
    market_code: Optional[str] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> CotReportResponse:
        raw = data.get("reports") or data.get("items") or []
        return cls(
            reports=[CotPositioning.from_dict(r) for r in raw],
            symbol=data.get("symbol"),
            market_code=data.get("market_code"),
        )


@dataclass
class CentralBankStanceResponse:
    bank: str
    stance: str
    name: Optional[str] = None
    rate: Optional[float] = None
    last_updated: Optional[str] = None
    summary: Optional[str] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> CentralBankStanceResponse:
        r = data.get("rate")
        return cls(
            bank=str(data.get("bank", "")),
            stance=str(data.get("stance", "")),
            name=data.get("name"),
            rate=float(r) if r is not None else None,
            last_updated=data.get("last_updated"),
            summary=data.get("summary"),
        )
