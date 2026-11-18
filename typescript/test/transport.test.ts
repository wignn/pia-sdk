import { describe, expect, it } from "bun:test";
import { resolveConfig } from "../src/config";
import {
  ApiError,
  AuthenticationError,
  NetworkError,
  PermissionError,
  RateLimitError,
  TimeoutError,
} from "../src/errors";
import { HttpTransport } from "../src/http/transport";
import { PiaClient } from "../src/client";

describe("HttpTransport - Resiliency, Retries, and Telemetry", () => {
  it("does not expose the API key when serializing the client", () => {
    const client = new PiaClient({ apiKey: "synthetic_client_api_key" });

    expect(JSON.stringify(client)).not.toContain("synthetic_client_api_key");
  });

  it("injects x-api-key, User-Agent, and custom headers", async () => {
    let capturedHeaders: Record<string, string> = {};

    const mockFetch = async (url: string, init?: RequestInit) => {
      capturedHeaders = (init?.headers as Record<string, string>) || {};
      return new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const config = resolveConfig({
      apiKey: "wi_live_custom_key",
      fetch: mockFetch as any,
      headers: { "X-Custom-Env": "staging" },
    });

    const transport = new HttpTransport(config);
    const result = await transport.request<{ status: string }>("/api/v1/test");

    expect(result.status).toBe("ok");
    expect(capturedHeaders["Authorization"]).toBe("Bearer wi_live_custom_key");
    expect(capturedHeaders["x-api-key"]).toBe("wi_live_custom_key");
    expect(capturedHeaders["User-Agent"]).toBe("pia-sdk-ts/1.3.16");
    expect(capturedHeaders["X-Custom-Env"]).toBe("staging");
  });

  it("parses RFC 6585 and daily quota telemetry headers", async () => {
    const mockFetch = async () => {
      return new Response(JSON.stringify({ data: 123 }), {
        status: 200,
        headers: {
          "x-ratelimit-limit": "60",
          "x-ratelimit-remaining": "59",
          "x-ratelimit-reset": "1",
          "x-dailyquota-limit": "1000",
          "x-dailyquota-remaining": "997",
        },
      });
    };

    const config = resolveConfig({
      apiKey: "test",
      fetch: mockFetch as any,
    });

    const transport = new HttpTransport(config);
    await transport.request("/api/v1/test");

    const telemetry = transport.getRateLimitInfo();
    expect(telemetry.limit).toBe(60);
    expect(telemetry.remaining).toBe(59);
    expect(telemetry.resetSeconds).toBe(1);
    expect(telemetry.dailyLimit).toBe(1000);
    expect(telemetry.dailyRemaining).toBe(997);
  });

  it("redacts synthetic credentials and credential-bearing URLs from API errors", async () => {
    const secret = "synthetic_secret_credential";
    const config = resolveConfig({ apiKey: "synthetic_key", fetch: (async () => new Response(JSON.stringify({ error: `failed at https://user:${secret}@api.example.test/path?token=${secret}` }), { status: 500 })) as any, maxRetries: 0 });
    const transport = new HttpTransport(config);
    try {
      await transport.request("/api/v1/test");
      throw new Error("Expected API request to fail");
    } catch (error) {
      expect(String(error)).not.toContain(secret);
      expect(JSON.stringify(error)).not.toContain("synthetic_key");
    }
  });

  it("maps HTTP 401 to AuthenticationError without retrying", async () => {
    let callCount = 0;
    const mockFetch = async () => {
      callCount++;
      return new Response(JSON.stringify({ error: "Invalid API key" }), {
        status: 401,
      });
    };

    const config = resolveConfig({
      apiKey: "bad_key",
      fetch: mockFetch as any,
      maxRetries: 3,
    });

    const transport = new HttpTransport(config);
    await expect(transport.request("/api/v1/test")).rejects.toThrow(AuthenticationError);
    expect(callCount).toBe(1); // 401 must not be retried
  });

  it("maps HTTP 403 to PermissionError without retrying", async () => {
    let callCount = 0;
    const mockFetch = async () => {
      callCount++;
      return new Response(JSON.stringify({ error: "Missing scope" }), {
        status: 403,
      });
    };

    const config = resolveConfig({
      apiKey: "key",
      fetch: mockFetch as any,
      maxRetries: 3,
    });

    const transport = new HttpTransport(config);
    await expect(transport.request("/api/v1/test")).rejects.toThrow(PermissionError);
    expect(callCount).toBe(1);
  });

  it("retries transient HTTP 500 errors and succeeds when backend recovers", async () => {
    let callCount = 0;
    const mockFetch = async () => {
      callCount++;
      if (callCount < 3) {
        return new Response(JSON.stringify({ error: "Internal Gateway Hiccup" }), {
          status: 502,
        });
      }
      return new Response(JSON.stringify({ recovered: true }), {
        status: 200,
      });
    };

    const config = resolveConfig({
      apiKey: "key",
      fetch: mockFetch as any,
      maxRetries: 3,
      retryDelayMs: 10, // Fast for tests
    });

    const transport = new HttpTransport(config);
    const res = await transport.request<{ recovered: boolean }>("/api/v1/test");

    expect(res.recovered).toBe(true);
    expect(callCount).toBe(3);
  });

  it("maps HTTP 429 to RateLimitError with retry-after header", async () => {
    const mockFetch = async () => {
      return new Response(JSON.stringify({ error: "Daily quota exhausted" }), {
        status: 429,
        headers: {
          "retry-after": "45",
          "x-dailyquota-remaining": "0",
        },
      });
    };

    const config = resolveConfig({
      apiKey: "key",
      fetch: mockFetch as any,
      maxRetries: 0, // Do not wait in test
    });

    const transport = new HttpTransport(config);
    try {
      await transport.request("/api/v1/test");
      expect(true).toBe(false); // Unreachable
    } catch (err: any) {
      expect(err instanceof RateLimitError).toBe(true);
      expect(err.retryAfterSeconds).toBe(45);
    }
  });

  it("throws TimeoutError when request duration exceeds timeoutMs", async () => {
    const mockFetch = async (url: string, init?: RequestInit) => {
      return new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new Error("aborted"));
        });
      });
    };

    const config = resolveConfig({
      apiKey: "key",
      fetch: mockFetch as any,
      timeoutMs: 100,
      maxRetries: 0,
    });

    const transport = new HttpTransport(config);
    await expect(transport.request("/api/v1/slow")).rejects.toThrow(TimeoutError);
  });

  it("times out when response body stalls after headers", async () => {
    const fetchMock = async (_url: string, init?: RequestInit) => new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("{"));
        init?.signal?.addEventListener("abort", () => controller.error(new Error("aborted")), { once: true });
      },
    }), { status: 200 });
    const transport = new HttpTransport(resolveConfig({ apiKey: "key", fetch: fetchMock as any, timeoutMs: 100, maxRetries: 0 }));

    await expect(transport.request("/api/v1/stalled-body")).rejects.toThrow(TimeoutError);
  });

  it("does not retry POST after a retryable response", async () => {
    let calls = 0;
    const fetchMock = async () => {
      calls++;
      return new Response("temporary", { status: 503 });
    };
    const transport = new HttpTransport(resolveConfig({ apiKey: "key", fetch: fetchMock as any, maxRetries: 2, retryDelayMs: 1 }));

    await expect(transport.request("/api/v1/write", "POST", {})).rejects.toThrow(ApiError);
    expect(calls).toBe(1);
  });

  it("does not retry POST after a network failure", async () => {
    let calls = 0;
    const fetchMock = async () => {
      calls++;
      throw new Error("connection reset");
    };
    const transport = new HttpTransport(resolveConfig({ apiKey: "key", fetch: fetchMock as any, maxRetries: 2, retryDelayMs: 1 }));

    await expect(transport.request("/api/v1/write", "POST", {})).rejects.toThrow(NetworkError);
    expect(calls).toBe(1);
  });

  it("stops after caller aborts during retry backoff", async () => {
    let calls = 0;
    const fetchMock = async () => {
      calls++;
      return new Response("temporary", { status: 503 });
    };
    const transport = new HttpTransport(resolveConfig({ apiKey: "key", fetch: fetchMock as any, maxRetries: 2, retryDelayMs: 30 }));
    const caller = new AbortController();
    const pending = transport.request("/api/v1/read", "GET", undefined, { signal: caller.signal });
    setTimeout(() => caller.abort(new Error("caller cancelled")), 5);

    await expect(pending).rejects.toThrow("caller cancelled");
    expect(calls).toBe(1);
  });

  it("parses HTTP-date Retry-After and caps it", async () => {
    const transport = new HttpTransport(resolveConfig({ apiKey: "key", maxRetryDelayMs: 12 }));
    const headers = new Headers({ "retry-after": new Date(Date.now() + 60_000).toUTCString() });

    expect((transport as any).calculateBackoffDelay(1, headers)).toBe(12);
  });

  it("uses fallback delay for non-HTTP date Retry-After strings", () => {
    const transport = new HttpTransport(resolveConfig({ apiKey: "key", maxRetryDelayMs: 10_000, retryDelayMs: 8 }));
    const headers = new Headers({ "retry-after": "January 1, 2030" });

    expect((transport as any).calculateBackoffDelay(1, headers)).toBeLessThan(100);
  });

  it("bounds invalid numeric Retry-After instead of parsing a numeric prefix", async () => {
    const transport = new HttpTransport(resolveConfig({ apiKey: "key", maxRetryDelayMs: 12, retryDelayMs: 8 }));
    const headers = new Headers({ "retry-after": "3seconds" });

    expect((transport as any).calculateBackoffDelay(1, headers)).toBeLessThanOrEqual(12);
    expect((transport as any).calculateBackoffDelay(1, headers)).toBeLessThan(3000);
  });

  it("uses fallback delay for fractional Retry-After rather than accepting non-RFC seconds", () => {
    const transport = new HttpTransport(resolveConfig({ apiKey: "key", maxRetryDelayMs: 10_000, retryDelayMs: 8 }));
    const headers = new Headers({ "retry-after": "3.5" });

    expect((transport as any).calculateBackoffDelay(1, headers)).toBeLessThan(100);
  });

  it("caps a valid oversized numeric Retry-After at the configured maximum", () => {
    const transport = new HttpTransport(resolveConfig({ apiKey: "key", maxRetryDelayMs: 12, retryDelayMs: 8 }));
    const headers = new Headers({ "retry-after": "9".repeat(400) });

    expect((transport as any).calculateBackoffDelay(1, headers)).toBe(12);
  });

  it("removes caller abort listener after completion", async () => {
    let addCount = 0;
    let removeCount = 0;
    const signal = new AbortController().signal;
    const add = signal.addEventListener.bind(signal);
    const remove = signal.removeEventListener.bind(signal);
    signal.addEventListener = ((...args: Parameters<AbortSignal["addEventListener"]>) => { addCount++; return add(...args); }) as AbortSignal["addEventListener"];
    signal.removeEventListener = ((...args: Parameters<AbortSignal["removeEventListener"]>) => { removeCount++; return remove(...args); }) as AbortSignal["removeEventListener"];
    const transport = new HttpTransport(resolveConfig({ apiKey: "key", fetch: (async () => new Response("{}")) as any }));

    await transport.request("/api/v1/ok", "GET", undefined, { signal });
    expect(addCount).toBe(1);
    expect(removeCount).toBe(1);
  });
});
