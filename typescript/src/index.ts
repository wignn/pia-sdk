/**
 * Official PIA SDK
 * Enterprise market intelligence & realtime streaming SDK.
 */

export { PiaClient } from "./client";
export {
  type PiaClientOptions,
  type ResolvedPiaConfig,
  resolveConfig,
} from "./config";
export {
  PiaError,
  ConfigurationError,
  ValidationError,
  AuthenticationError,
  PermissionError,
  RateLimitError,
  TimeoutError,
  NetworkError,
  ParseError,
  ApiError,
  redactSensitive,
} from "./errors";
export {
  type Timeframe,
  type RateLimitInfo,
  type RequestOptions,
  type MarketPrice,
  type MarketPricesResponse,
  type SymbolItem,
  type SymbolsResponse,
  type GetSymbolsOptions,
  type Candle,
  type CandleResponse,
  type GetCandlesOptions,
  type OrderBook,
  type OrderBookLevel,
  type SocialPost,
  type SocialFeedResponse,
  type SocialPostItem,
  type SocialPostsResponse,
  type GetSocialPostsOptions,
  type GetSocialOptions,
  type NewsArticle,
  type NewsFeedResponse,
  type GetNewsOptions,
  type EconomicEvent,
  type EconomicCalendarResponse,
  type GetCalendarOptions,
  type YieldCurvePoint,
  type YieldCurveResponse,
  type WsTicketResponse,
  type OptionContract,
  type OptionChainResponse,
  type OptionGexResponse,
  type OptionSummaryResponse,
  type FearGreedData,
  type FearGreedHistoryResponse,
  type CotPositioning,
  type CotReportResponse,
  type CentralBankStanceResponse,
} from "./types";
export {
  RealtimeClient,
  type SocketState,
} from "./realtime/socket";
export {
  type RealtimeEvents,
} from "./realtime/events";
export { MarketResource } from "./resources/market";
export { IntelligenceResource, type IntelligenceAnalyzeRequest, type IntelligenceAnalyzeResponse, type MarketInsightResponse } from "./resources/intelligence";
export { OptionsResource } from "./resources/options";
export { MacroResource } from "./resources/macro";
export { GeosignalsResource, type GeoSignalEvent, type GeoSignalsResponse, type GeoSignalsMapResponse, type GeoSignalsAssetImpactResponse } from "./resources/geosignals";
export { EnergyResource, type EnergyDashboardResponse, type EnergySeriesResponse } from "./resources/energy";
export { SecResource, type SecFilingItem, type SecFilingsResponse, type GetSecFilingsOptions } from "./resources/sec";
export { SocialResource } from "./resources/social";
export { NewsResource } from "./resources/news";
export { EconomicResource } from "./resources/economic";
export { FixedIncomeResource } from "./resources/fixed-income";
export { WsResource } from "./resources/ws";
