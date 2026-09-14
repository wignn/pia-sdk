/**
 * Official PIA SDK
 * Enterprise market intelligence & realtime streaming SDK.
 */

export { PiaClient } from "./client";
export {
  type PiaClientOptions,
  type ResolvedPiaConfig,
  resolveConfig,
  DEFAULT_BASE_URL,
  DEFAULT_WS_URL,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_MAX_RETRIES,
} from "./config";

export {
  PiaError,
  type PiaErrorDetails,
  ConfigurationError,
  ValidationError,
  AuthenticationError,
  PermissionError,
  RateLimitError,
  TimeoutError,
  NetworkError,
  ParseError,
  ApiError,
} from "./errors";

export {
  type PiaLogger,
  type LogLevel,
  DefaultLogger,
  redactSensitive,
} from "./logger";

export {
  type Timeframe,
  type RateLimitInfo,
  type RequestOptions,
  type MarketPrice,
  type MarketPricesResponse,
  type Candle,
  type CandleResponse,
  type GetCandlesOptions,
  type OrderBook,
  type OrderBookLevel,
  type SocialPost,
  type SocialFeedResponse,
  type GetSocialOptions,
  type SocialPostItem,
  type SocialPostsResponse,
  type GetSocialPostsOptions,
  type OptionContract,
  type OptionChainResponse,
  type OptionGexResponse,
  type OptionSummaryResponse,
  type FearGreedData,
  type FearGreedHistoryResponse,
  type CotPositioning,
  type CotReportResponse,
  type CentralBankStanceResponse,
  type NewsArticle,
  type NewsFeedResponse,
  type GetNewsOptions,
  type EconomicEvent,
  type EconomicCalendarResponse,
  type GetCalendarOptions,
  type YieldCurvePoint,
  type YieldCurveResponse,
  type MarketInsight,
  type WsTicketResponse,
} from "./types";

export { MarketResource } from "./resources/market";
export { OptionsResource } from "./resources/options";
export { MacroResource } from "./resources/macro";
export { SocialResource } from "./resources/social";
export { NewsResource } from "./resources/news";
export { EconomicResource } from "./resources/economic";
export { FixedIncomeResource } from "./resources/fixed-income";
export { WsResource } from "./resources/ws";
export { RealtimeClient, type SocketState } from "./realtime/socket";
export { type RealtimeEvents } from "./realtime/events";
