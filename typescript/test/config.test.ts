import { describe, expect, it } from "bun:test";
import { ConfigurationError, PiaClient, resolveConfig } from "../src";

describe("SDK Config Resolution", () => {
  it("does not expose the API key in the public client config", () => {
    const sentinel = "synthetic_client_config_secret";
    const client = new PiaClient({ apiKey: sentinel });
    expect(String(client.config)).not.toContain(sentinel);
    expect(JSON.stringify(client.config)).not.toContain(sentinel);
  });

  it("resolves default configuration when apiKey is provided", () => {
    const config = resolveConfig({ apiKey: "wi_live_test123" });
    expect(config.apiKey).toBe("wi_live_test123");
    expect(config.baseUrl).toBe("https://api-engine.wign.dev");
    expect(config.wsUrl).toBe("wss://api-engine.wign.dev/api/v1/ws");
    expect(config.timeoutMs).toBe(15000);
    expect(config.maxRetries).toBe(3);
    expect(config.retryDelayMs).toBe(500);
    expect(config.debug).toBe(false);
  });

  it("throws ConfigurationError when apiKey is missing and env is unset", () => {
    const originalEnv = process.env.PIA_API_KEY;
    delete process.env.PIA_API_KEY;
    delete process.env.ATSLD_API_KEY;
    delete process.env.CORE_API_KEY;

    expect(() => resolveConfig({})).toThrow(ConfigurationError);

    if (originalEnv) process.env.PIA_API_KEY = originalEnv;
  });

  it("reads API key from process.env.PIA_API_KEY fallback", () => {
    process.env.PIA_API_KEY = "wi_live_from_env";
    const config = resolveConfig({});
    expect(config.apiKey).toBe("wi_live_from_env");
    delete process.env.PIA_API_KEY;
  });

  it("allows a path in baseUrl while rejecting query strings and fragments", () => {
    const config = resolveConfig({ apiKey: "test", baseUrl: "https://custom.wign.dev/gateway/v1/" });
    expect(config.baseUrl).toBe("https://custom.wign.dev/gateway/v1");
    for (const baseUrl of [
      "https://custom.wign.dev?tenant=one",
      "https://custom.wign.dev#section",
      "https://custom.wign.dev?",
      "https://custom.wign.dev#",
    ]) {
      expect(() => resolveConfig({ apiKey: "test", baseUrl })).toThrow(ConfigurationError);
    }
  });

  it("strips trailing slashes from baseUrl and wsUrl", () => {
    const config = resolveConfig({
      apiKey: "test",
      baseUrl: "https://custom.wign.dev///",
      wsUrl: "wss://custom.wign.dev/ws///",
    });
    expect(config.baseUrl).toBe("https://custom.wign.dev");
    expect(config.wsUrl).toBe("wss://custom.wign.dev/ws");
  });

  it("rejects insecure credential-bearing base and WebSocket URLs", () => {
    expect(() => resolveConfig({ apiKey: "synthetic_key", baseUrl: "http://api.example.test" })).toThrow(ConfigurationError);
    expect(() => resolveConfig({ apiKey: "synthetic_key", wsUrl: "ws://api.example.test/ws" })).toThrow(ConfigurationError);
  });

  it("does not expose credential-bearing URL contents in configuration errors", () => {
    const sentinel = "synthetic_secret_credential";
    try {
      resolveConfig({ apiKey: "synthetic_key", baseUrl: `http://user:${sentinel}@api.example.test/path?token=${sentinel}` });
      throw new Error("Expected invalid URL configuration");
    } catch (error) {
      expect(String(error)).not.toContain(sentinel);
    }
  });

  it("throws on invalid URL protocol", () => {
    expect(() =>
      resolveConfig({ apiKey: "test", baseUrl: "ftp://invalid-url" })
    ).toThrow(ConfigurationError);

    expect(() =>
      resolveConfig({ apiKey: "test", wsUrl: "http://invalid-ws" })
    ).toThrow(ConfigurationError);
  });

  it("throws on negative maxRetries or too small timeoutMs", () => {
    expect(() =>
      resolveConfig({ apiKey: "test", maxRetries: -1 })
    ).toThrow(ConfigurationError);

    expect(() =>
      resolveConfig({ apiKey: "test", timeoutMs: 50 })
    ).toThrow(ConfigurationError);
  });
});
