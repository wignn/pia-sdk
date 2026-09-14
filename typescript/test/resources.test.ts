import { describe, expect, it } from "bun:test";
import { resolveConfig } from "../src/config";
import { HttpTransport } from "../src/http/transport";
import { MacroResource } from "../src/resources/macro";
import { OptionsResource } from "../src/resources/options";
import { SocialResource } from "../src/resources/social";
import { IntelligenceResource } from "../src/resources/intelligence";
import { SecResource } from "../src/resources/sec";
import { EnergyResource } from "../src/resources/energy";
import { GeosignalsResource } from "../src/resources/geosignals";
import { MarketResource } from "../src/resources/market";
import { EconomicResource } from "../src/resources/economic";

describe("Comprehensive Intelligence Resources (Options, Macro, Social, Intelligence, SEC, Energy, Geo)", () => {
  it("fetches option chain and GEX for a symbol", async () => {
    const config = resolveConfig({
      apiKey: "wi_live_test_key",
      fetch: (async (url: string) => {
        if (url.includes("/api/v1/options/chain/NVDA")) {
          return new Response(
            JSON.stringify({
              symbol: "NVDA",
              underlying_price: 125.5,
              expirations: ["2026-09-18"],
              contracts: [],
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          );
        }
        if (url.includes("/api/v1/options/gex/SPX")) {
          return new Response(
            JSON.stringify({
              symbol: "SPX",
              net_gex: 150000000.0,
              zero_gamma_level: 5600.0,
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          );
        }
        return new Response("Not found", { status: 404 });
      }) as any,
    });

    const transport = new HttpTransport(config);
    const options = new OptionsResource(transport);

    const chain = await options.getChain("nvda");
    expect(chain.symbol).toBe("NVDA");
    expect(chain.underlying_price).toBe(125.5);

    const gex = await options.getGex("spx");
    expect(gex.symbol).toBe("SPX");
    expect(gex.net_gex).toBe(150000000.0);
  });

  it("fetches AI market intelligence and catalysts", async () => {
    const config = resolveConfig({
      apiKey: "wi_live_test_key",
      fetch: (async (url: string, init: any) => {
        if (url.includes("/api/v1/intelligence/analyze")) {
          return new Response(
            JSON.stringify({
              symbol: "BTCUSDT",
              sentiment: "bullish",
              analysis: "Strong institutional accumulation detected above $60k.",
              generated_at: "2026-09-14T00:00:00Z",
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          );
        }
        return new Response("Not found", { status: 404 });
      }) as any,
    });

    const transport = new HttpTransport(config);
    const intelligence = new IntelligenceResource(transport);

    const res = await intelligence.analyze({ symbol: "BTCUSDT" });
    expect(res.sentiment).toBe("bullish");
    expect(res.analysis).toContain("accumulation");
  });

  it("fetches SEC filings and energy dashboard", async () => {
    const config = resolveConfig({
      apiKey: "wi_live_test_key",
      fetch: (async (url: string) => {
        if (url.includes("/api/v1/sec/filings")) {
          return new Response(
            JSON.stringify({
              total: 1,
              items: [{ id: "filing-1", symbol: "AAPL", form_type: "10-Q" }],
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          );
        }
        if (url.includes("/api/v1/energy/dashboard")) {
          return new Response(
            JSON.stringify({
              crude_oil: { wti_price: 78.5, brent_price: 82.3 },
              updated_at: "2026-09-14T00:00:00Z",
            }),
            { status: 200, headers: { "content-type": "application/json" } }
          );
        }
        return new Response("Not found", { status: 404 });
      }) as any,
    });

    const transport = new HttpTransport(config);
    const sec = new SecResource(transport);
    const energy = new EnergyResource(transport);

    const filings = await sec.getFilings({ symbol: "AAPL" });
    expect(filings.total).toBe(1);
    expect(filings.items[0].form_type).toBe("10-Q");

    const dash = await energy.getDashboard();
    expect(dash.crude_oil?.wti_price).toBe(78.5);
  });
});
