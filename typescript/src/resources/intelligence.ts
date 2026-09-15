/**
 * Official PIA SDK - AI Intelligence & Market Analysis Resource
 */

import { ValidationError } from "../errors";
import type { HttpTransport } from "../http/transport";
import type { RequestOptions } from "../types";

export interface IntelligenceAnalyzeRequest {
  symbol?: string;
  query?: string;
  text?: string;
  context?: Record<string, any>;
}

export interface IntelligenceAnalyzeResponse {
  symbol?: string;
  sentiment?: "bullish" | "bearish" | "neutral" | string;
  confidence?: number;
  analysis: string;
  catalysts?: string[];
  key_levels?: {
    support?: number[];
    resistance?: number[];
  };
  generated_at: string;
}

export interface MarketInsightResponse {
  symbol: string;
  summary: string;
  sentiment: string;
  drivers?: string[];
  timestamp?: string;
}

export class IntelligenceResource {
  constructor(private readonly transport: HttpTransport) {}

  /**
   * Generates AI-powered real-time quantitative analysis and catalyst explanations.
   * Accepts either a symbol string (e.g. "ETHUSDT") or a structured request payload.
   */
  public async analyze(
    request: string | IntelligenceAnalyzeRequest,
    options?: RequestOptions
  ): Promise<IntelligenceAnalyzeResponse> {
    const payload: IntelligenceAnalyzeRequest =
      typeof request === "string"
        ? { symbol: request, query: request, text: request }
        : request;

    return this.transport.request<IntelligenceAnalyzeResponse>(
      "/api/v1/intelligence/analyze",
      "POST",
      payload,
      options
    );
  }

  /**
   * Retrieves synthesized AI narrative insights and price drivers for a specific symbol.
   */
  public async getInsights(
    symbol: string,
    options?: RequestOptions
  ): Promise<MarketInsightResponse> {
    if (!symbol || typeof symbol !== "string" || symbol.trim() === "") {
      throw new ValidationError("Symbol must be a non-empty string.", "symbol");
    }
    const cleanSymbol = symbol.trim().toUpperCase();
    return this.transport.request<MarketInsightResponse>(
      `/api/v1/market/insights/${encodeURIComponent(cleanSymbol)}`,
      "GET",
      undefined,
      options
    );
  }
}
