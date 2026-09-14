import { describe, expect, it } from "bun:test";
import { resolveConfig } from "../src/config";
import { HttpTransport } from "../src/http/transport";
import { MacroResource } from "../src/resources/macro";
import { OptionsResource } from "../src/resources/options";
import { SocialResource } from "../src/resources/social";

describe("New Intelligence Resources (Options, Macro, Social Posts)", () => {
  it("fetches option chain and GEX for a symbol", async () => {
    let capturedUrl = "";
    const mockFetch = async (url: string) => {
      capturedUrl = url;
      return new Response(
        JSON.stringify({
          symbol: "NVDA",
          underlying_price: 125.4,
          expirations: ["2026-09-18"],
          contracts: [],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };

    const config = resolveConfig({
      apiKey: "wi_live_test",
      fetch: mockFetch as any,
    });
    const transport = new HttpTransport(config);
    const options = new OptionsResource(transport);

    const chain = await options.getChain("NVDA");
    expect(chain.symbol).toBe("NVDA");
    expect(capturedUrl).toContain("/api/v1/options/chain/NVDA");

    await options.getGex("SPX");
    expect(capturedUrl).toContain("/api/v1/options/gex/SPX");
  });

  it("fetches Fear & Greed index and COT reports", async () => {
    let capturedUrl = "";
    const mockFetch = async (url: string) => {
      capturedUrl = url;
      return new Response(
        JSON.stringify({
          score: 65,
          rating: "greed",
          timestamp: Date.now(),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };

    const config = resolveConfig({
      apiKey: "wi_live_test",
      fetch: mockFetch as any,
    });
    const transport = new HttpTransport(config);
    const macro = new MacroResource(transport);

    const fg = await macro.getFearGreed();
    expect(fg.score).toBe(65);
    expect(capturedUrl).toContain("/api/v1/fear-greed");

    await macro.getCot("GOLD");
    expect(capturedUrl).toContain("/api/v1/cot/symbol/GOLD");

    await macro.getCentralBankStance("fed");
    expect(capturedUrl).toContain("/api/v1/central-banks/fed/stance");
  });

  it("fetches social posts from PostgreSQL ingestion pipeline", async () => {
    let capturedUrl = "";
    const mockFetch = async (url: string) => {
      capturedUrl = url;
      return new Response(
        JSON.stringify({
          has_more: false,
          items: [
            {
              author_username: "coinbureau",
              text: "Bitcoin market dynamic update",
              url: "https://x.com/coinbureau/123",
              created_at: "2026-09-13T10:00:00Z",
              platform: "twitter",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };

    const config = resolveConfig({
      apiKey: "wi_live_test",
      fetch: mockFetch as any,
    });
    const transport = new HttpTransport(config);
    const social = new SocialResource(transport);

    const res = await social.getPosts({ limit: 10, symbol: "BTC" });
    expect(res.items.length).toBe(1);
    expect(res.items[0].author_username).toBe("coinbureau");
    expect(capturedUrl).toContain("/api/v1/social/posts?symbol=BTC&limit=10");
  });
});
