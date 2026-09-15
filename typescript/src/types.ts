/**
 * Official PIA SDK - Type Definitions & Contracts
 */

export type Timeframe = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

export interface RateLimitInfo {
  limit?: number;
  remaining?: number;
  resetSeconds?: number;
  dailyLimit?: number;
  dailyRemaining?: number;
}

export interface RequestOptions {
  timeoutMs?: number;
  maxRetries?: number;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export interface MarketPrice {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  high_24h?: number;
  low_24h?: number;
  change_24h_pct?: number;
  volume_24h?: number;
  asset_type?: "fx" | "crypto" | "equity" | "commodity" | "index" | string;
  session_open?: boolean;
  timestamp?: number;
}

export interface MarketPricesResponse {
  items: MarketPrice[];
  total: number;
  timestamp?: string;
}

export interface SymbolItem {
  symbol: string;
  name?: string;
  asset_type: string;
  exchange: string;
  source: string;
  price_precision: number;
  tick_size: number;
  is_active: boolean;
  last_price?: number;
}

export interface SymbolsResponse {
  total: number;
  items: SymbolItem[];
}

export interface GetSymbolsOptions extends RequestOptions {
  asset_type?: "crypto" | "forex" | "stock" | "commodity" | "index" | "rates" | string;
  search?: string;
  exchange?: string;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface CandleResponse {
  symbol: string;
  timeframe: string;
  count: number;
  candles: Candle[];
}

export interface GetCandlesOptions extends RequestOptions {
  timeframe?: Timeframe;
  limit?: number;
  since?: number;
  until?: number;
}

export interface OrderBookLevel {
  price: number;
  size: number;
}

export interface OrderBook {
  symbol: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  timestamp: number;
}

export interface SocialPost {
  id: string;
  author: string;
  author_handle: string;
  content: string;
  media_urls?: string[];
  sentiment?: "bullish" | "bearish" | "neutral";
  symbols?: string[];
  posted_at: string;
}

export interface SocialFeedResponse {
  total: number;
  posts: SocialPost[];
  cursor?: string;
}

export interface GetSocialOptions extends RequestOptions {
  symbol?: string;
  limit?: number;
  cursor?: string;
}

export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  symbols?: string[];
  published_at: string;
}

export interface NewsFeedResponse {
  total: number;
  items: NewsArticle[];
}

export interface GetNewsOptions extends RequestOptions {
  symbols?: string[];
  category?: "forex" | "stock" | "all" | string;
  limit?: number;
}

export interface EconomicEvent {
  id?: string;
  event: string;
  country: string;
  currency?: string;
  date: string;
  time?: string;
  actual?: number | null;
  forecast?: number | null;
  previous?: number | null;
  impact?: "high" | "medium" | "low" | string;
}

export interface EconomicCalendarResponse {
  total: number;
  items: EconomicEvent[];
}

export interface GetCalendarOptions extends RequestOptions {
  impact?: string;
  limit?: number;
}

export interface YieldCurvePoint {
  tenor: string;
  yield: number;
  date?: string;
}

export interface YieldCurveResponse {
  date: string;
  points: YieldCurvePoint[];
}

export interface MarketInsight {
  symbol: string;
  title: string;
  summary: string;
  sentiment?: string;
  confidence?: number;
}

export interface WsTicketResponse {
  ticket: string;
  expires_in?: number;
  ws_url?: string;
}

export interface SocialPostItem {
  author_username: string;
  author_display_name?: string;
  text: string;
  url: string;
  created_at: string;
  platform: string;
  like_count?: number;
  retweet_count?: number;
  media_urls?: string[];
  source_account?: string;
}

export interface SocialPostsResponse {
  has_more: boolean;
  items: SocialPostItem[];
  next_before?: string | null;
}

export interface GetSocialPostsOptions extends RequestOptions {
  limit?: number;
  cursor?: string;
  symbol?: string;
}

export interface OptionContract {
  symbol: string;
  strike: number;
  expiration: string;
  option_type: "call" | "put" | string;
  bid?: number;
  ask?: number;
  last?: number;
  volume?: number;
  open_interest?: number;
  implied_volatility?: number;
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
}

export interface OptionChainResponse {
  symbol: string;
  underlying_price?: number;
  expirations: string[];
  contracts: OptionContract[];
}

export interface OptionGexResponse {
  symbol: string;
  net_gex?: number;
  total_call_gex?: number;
  total_put_gex?: number;
  zero_gamma_level?: number;
  major_positive_levels?: Array<{ strike: number; gex: number }>;
  major_negative_levels?: Array<{ strike: number; gex: number }>;
  updated_at?: string;
}

export interface OptionSummaryResponse {
  total_volume?: number;
  total_open_interest?: number;
  put_call_ratio?: number;
  most_active_symbols?: Array<{ symbol: string; volume: number }>;
}

export interface FearGreedData {
  score: number;
  rating: string;
  timestamp: string | number;
  previous_close?: number;
  previous_1_week?: number;
  previous_1_month?: number;
  previous_1_year?: number;
}

export interface FearGreedHistoryResponse {
  current: FearGreedData;
  history: Array<{ score: number; rating: string; timestamp: string | number }>;
}

export interface CotPositioning {
  market_code: string;
  market_name?: string;
  report_date: string;
  commercial_long?: number;
  commercial_short?: number;
  non_commercial_long?: number;
  non_commercial_short?: number;
  net_position?: number;
}

export interface CotReportResponse {
  symbol?: string;
  market_code?: string;
  reports: CotPositioning[];
}

export interface CentralBankStanceResponse {
  bank: string;
  name?: string;
  stance: "hawkish" | "dovish" | "neutral" | string;
  rate?: number;
  last_updated?: string;
  summary?: string;
}
