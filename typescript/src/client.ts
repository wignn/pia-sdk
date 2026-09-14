/**
 * Official PIA SDK - Main Client Facade
 */

import { type PiaClientOptions, type ResolvedPiaConfig, resolveConfig } from "./config";
import { HttpTransport } from "./http/transport";
import { RealtimeClient } from "./realtime/socket";
import { MarketResource } from "./resources/market";
import { IntelligenceResource } from "./resources/intelligence";
import { OptionsResource } from "./resources/options";
import { MacroResource } from "./resources/macro";
import { GeosignalsResource } from "./resources/geosignals";
import { EnergyResource } from "./resources/energy";
import { SecResource } from "./resources/sec";
import { SocialResource } from "./resources/social";
import { NewsResource } from "./resources/news";
import { EconomicResource } from "./resources/economic";
import { FixedIncomeResource } from "./resources/fixed-income";
import { WsResource } from "./resources/ws";
import type { RateLimitInfo } from "./types";

export class PiaClient {
  public readonly config: Readonly<ResolvedPiaConfig>;
  private readonly transport: HttpTransport;

  /**
   * Market data & prices API resource.
   */
  public readonly market: MarketResource;

  /**
   * AI-powered quantitative intelligence and narrative catalysts resource.
   */
  public readonly intelligence: IntelligenceResource;

  /**
   * Derivatives, options chain, and Gamma Exposure (GEX) resource.
   */
  public readonly options: OptionsResource;

  /**
   * Macro indicators, Fear & Greed index, COT positioning, and central banks.
   */
  public readonly macro: MacroResource;

  /**
   * Geopolitical risk alerts, conflict mapping, and asset exposure resource.
   */
  public readonly geosignals: GeosignalsResource;

  /**
   * Energy benchmarks, crude spreads, and natural gas storage resource.
   */
  public readonly energy: EnergyResource;

  /**
   * SEC EDGAR corporate filings (10-K, 10-Q, 8-K, Form 4) resource.
   */
  public readonly sec: SecResource;

  /**
   * Social sentiment and discussions resource.
   */
  public readonly social: SocialResource;

  /**
   * Financial news resource.
   */
  public readonly news: NewsResource;

  /**
   * Macroeconomic calendar and indicators resource.
   */
  public readonly economic: EconomicResource;

  /**
   * Sovereign bond yields and fixed income rates resource.
   */
  public readonly fixedIncome: FixedIncomeResource;

  /**
   * WebSocket ticket issuance resource.
   */
  public readonly ws: WsResource;

  /**
   * Resilient realtime WebSocket streaming client with In-Band Auth.
   */
  public readonly realtime: RealtimeClient;

  /**
   * Initializes a new PIA API Client.
   */
  constructor(options?: PiaClientOptions) {
    this.config = resolveConfig(options);
    this.transport = new HttpTransport(this.config);

    this.market = new MarketResource(this.transport);
    this.intelligence = new IntelligenceResource(this.transport);
    this.options = new OptionsResource(this.transport);
    this.macro = new MacroResource(this.transport);
    this.geosignals = new GeosignalsResource(this.transport);
    this.energy = new EnergyResource(this.transport);
    this.sec = new SecResource(this.transport);
    this.social = new SocialResource(this.transport);
    this.news = new NewsResource(this.transport);
    this.economic = new EconomicResource(this.transport);
    this.fixedIncome = new FixedIncomeResource(this.transport);
    this.ws = new WsResource(this.transport);
    this.realtime = new RealtimeClient(this.config);
  }

  /**
   * Returns telemetry on rate limit and daily quota usage from the latest request.
   */
  public getRateLimitInfo(): RateLimitInfo {
    return this.transport.getRateLimitInfo();
  }
}
