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
  total: number;
  timestamp: number;
  items: MarketPrice[];
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
