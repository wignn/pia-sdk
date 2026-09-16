/**
 * Official PIA SDK - Macro & Market Sentiment Resource
 */

import { ValidationError } from "../errors";
import type { HttpTransport } from "../http/transport";
import type {
  CentralBankStanceResponse,
  CotReportResponse,
  FearGreedData,
  FearGreedHistoryResponse,
  RequestOptions,
} from "../types";

export class MacroResource {
  constructor(private readonly transport: HttpTransport) {}

  /**
   * Retrieves the current Fear & Greed Index score and sentiment rating.
   */
  public async getFearGreed(options?: RequestOptions): Promise<FearGreedData> {
    return this.transport.request<FearGreedData>(
      "/api/v1/fear-greed",
      "GET",
      undefined,
      options
    );
  }

  /**
   * Retrieves historical Fear & Greed Index time series.
   */
  public async getFearGreedHistory(
    options?: RequestOptions
  ): Promise<FearGreedHistoryResponse> {
    return this.transport.request<FearGreedHistoryResponse>(
      "/api/v1/fear-greed/history",
      "GET",
      undefined,
      options
    );
  }

  /**
   * Fetches CFTC Commitment of Traders (COT) institutional positioning report for a symbol.
   *
   * @param symbol Commodity/Currency/Index symbol (e.g. "GOLD", "WTI", "EURUSD", "SPX")
   */
  public async getCot(
    symbol: string,
    options?: RequestOptions
  ): Promise<CotReportResponse> {
    if (!symbol || typeof symbol !== "string" || symbol.trim() === "") {
      throw new ValidationError("Symbol must be a non-empty string.", "symbol");
    }

    const clean = symbol.trim().toUpperCase();
    const raw = await this.transport.request<any>(
      `/api/v1/cot/symbol/${encodeURIComponent(clean)}`,
      "GET",
      undefined,
      options
    );
    const reports = raw?.reports || raw?.data || raw?.items || [];
    return { ...raw, symbol: clean, reports: Array.isArray(reports) ? reports : [] };
  }

  /**
   * Fetches monetary policy stance and interest rate assessment for a central bank.
   *
   * @param bank Bank code (e.g. "fed", "ecb", "boj", "bi", "boe")
   */
  public async getCentralBankStance(
    bank: string,
    options?: RequestOptions
  ): Promise<CentralBankStanceResponse> {
    if (!bank || typeof bank !== "string" || bank.trim() === "") {
      throw new ValidationError("Bank must be a non-empty string.", "bank");
    }

    const clean = bank.trim().toLowerCase();
    const raw = await this.transport.request<any>(
      `/api/v1/central-banks/${encodeURIComponent(clean)}/stance`,
      "GET",
      undefined,
      options
    );
    return raw?.data && typeof raw.data === "object" ? { ...raw.data, bank: raw.data.bank || clean } : raw;
  }
}
