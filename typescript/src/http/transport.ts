/**
 * Official PIA SDK - Resilient HTTP Transport with Exponential Backoff & Telemetry
 */

import type { ResolvedPiaConfig } from "../config";
import {
  PiaApiError,
  PiaAuthenticationError,
  PiaNetworkError,
  PiaRateLimitError,
  PiaUnsupportedFeatureError,
  ParseError,
  PermissionError,
  TimeoutError,
} from "../errors";
import type { RateLimitInfo, RequestOptions } from "../types";

const RETRYABLE_STATUS_CODES = new Set([
  408, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524, 525, 526, 530
]);
const SDK_VERSION = "1.3.16";

function isRetrySafeMethod(method: string): boolean {
  return method === "GET" || method === "HEAD";
}

export class HttpTransport {
  private lastRateLimitInfo: RateLimitInfo = {};
  readonly #config: ResolvedPiaConfig;

  constructor(config: ResolvedPiaConfig) {
    this.#config = config;
  }

  /**
   * Returns the most recent rate limit headers telemetry recorded by the SDK.
   */
  public getRateLimitInfo(): RateLimitInfo {
    return { ...this.lastRateLimitInfo };
  }

  /**
   * Executes an HTTP request with automatic retry, jittered backoff, and timeout.
   */
  public async request<T>(
    endpoint: string,
    method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
    body?: unknown,
    options?: RequestOptions
  ): Promise<T> {
    const url = `${this.#config.baseUrl}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
    const maxRetries = options?.maxRetries ?? this.#config.maxRetries;
    const timeoutMs = options?.timeoutMs ?? this.#config.timeoutMs;

    let attempt = 0;

    while (true) {
      attempt++;
      this.#config.logger.debug(
        `HTTP ${method} ${endpoint} (Attempt ${attempt}/${maxRetries + 1})`
      );

      const controller = new AbortController();
      let isTimedOut = false;

      const timer = setTimeout(() => {
        isTimedOut = true;
        controller.abort();
      }, timeoutMs);

      // Chain caller's abort signal if provided
      const callerSignal = options?.signal;
      const onCallerAbort = () => controller.abort(callerSignal?.reason);
      if (callerSignal) {
        if (callerSignal.aborted) {
          clearTimeout(timer);
          throw callerSignal.reason;
        }
        callerSignal.addEventListener("abort", onCallerAbort, { once: true });
      }

      try {
        const headers: Record<string, string> = {
          Authorization: `Bearer ${this.#config.apiKey}`,
          "x-api-key": this.#config.apiKey,
          Accept: "application/json",
          "User-Agent": `pia-sdk-ts/${SDK_VERSION}`,
          ...this.#config.headers,
          ...(options?.headers || {}),
        };

        let serializedBody: string | undefined;
        if (body !== undefined) {
          headers["Content-Type"] = "application/json";
          serializedBody = JSON.stringify(body);
        }

        const response = await this.#config.fetch(url, {
          method,
          headers,
          body: serializedBody,
          signal: controller.signal,
        });

        // Keep the deadline active until the body has been fully consumed.

        // Extract rate limit and quota headers
        this.parseTelemetryHeaders(response.headers);

        if (response.ok) {
          return await this.parseResponseBody<T>(response, endpoint, method);
        }

        // Handle error responses
        const status = response.status;
        const errorText = await response.text().catch(() => "");
        let errorJson: unknown;
        try {
          if (errorText) errorJson = JSON.parse(errorText);
        } catch {
          // Ignored if not JSON
        }

        const errorObject =
          errorJson && typeof errorJson === "object"
            ? (errorJson as Record<string, unknown>)
            : undefined;
        const isHtml =
          errorText.trim().startsWith("<!DOCTYPE") ||
          errorText.trim().startsWith("<html");
        const rawErrorMessage =
          (typeof errorObject?.message === "string" && errorObject.message) ||
          (typeof errorObject?.error === "string" && errorObject.error) ||
          (typeof (errorObject as any)?.title === "string" && (errorObject as any).title) ||
          (errorText && !isHtml ? errorText.slice(0, 200) : `HTTP ${status}`);
        const errorMessage = isHtml
          ? `Edge tunnel gateway temporarily unavailable (HTTP ${status})`
          : rawErrorMessage;

        const isRetryable =
          RETRYABLE_STATUS_CODES.has(status) && attempt <= maxRetries && isRetrySafeMethod(method);

        if (isRetryable) {
          const delay = this.calculateBackoffDelay(attempt, response.headers);
          await this.sleep(delay, callerSignal);
          this.#config.logger.warn(
            `Request to ${endpoint} failed with HTTP ${status}. Retrying in ${delay}ms...`
          );
          continue;
        }

        // Map non-retryable or exhausted errors
        this.handleHttpError(status, errorMessage, endpoint, method, response.headers, errorJson);
      } catch (err: unknown) {
        if (isTimedOut) {
          throw new TimeoutError(
            `Request to ${endpoint} exceeded timeout of ${timeoutMs}ms.`,
            timeoutMs,
            { endpoint, method }
          );
        }

        // If caller explicitly aborted
        if (callerSignal?.aborted) {
          throw callerSignal.reason;
        }

        // If it's already a typed PiaError, rethrow
        if (err instanceof Error && "isPiaError" in err) {
          throw err;
        }

        // Check if transient network failure is retryable
        if (attempt <= maxRetries && isRetrySafeMethod(method)) {
          const delay = this.calculateBackoffDelay(attempt);
          this.#config.logger.warn(
            `Network error calling ${endpoint}: ${err instanceof Error ? err.message : String(err)}. Retrying in ${delay}ms...`
          );
          await this.sleep(delay, callerSignal);
          continue;
        }

        throw new PiaNetworkError(
          `Network transport failed connecting to ${endpoint}: ${err instanceof Error ? err.message : String(err)}`,
          err,
          { endpoint, method }
        );
      } finally {
        clearTimeout(timer);
        callerSignal?.removeEventListener("abort", onCallerAbort);
      }
    }
  }

  private parseTelemetryHeaders(headers: Headers): void {
    const parseNum = (name: string): number | undefined => {
      const val = headers.get(name);
      if (!val) return undefined;
      const num = parseInt(val, 10);
      return Number.isFinite(num) ? num : undefined;
    };

    this.lastRateLimitInfo = {
      limit: parseNum("x-ratelimit-limit"),
      remaining: parseNum("x-ratelimit-remaining"),
      resetSeconds: parseNum("x-ratelimit-reset"),
      dailyLimit: parseNum("x-dailyquota-limit"),
      dailyRemaining: parseNum("x-dailyquota-remaining"),
    };
  }

  private calculateBackoffDelay(attempt: number, headers?: Headers): number {
    // Respect Retry-After header if provided
    const retryAfter = headers?.get("retry-after");
    if (retryAfter) {
      const trimmed = retryAfter.trim();
      if (/^\d+$/.test(trimmed)) {
        const parsedSeconds = Number(trimmed);
        if (!Number.isFinite(parsedSeconds)) {
          return this.#config.maxRetryDelayMs;
        }
        if (parsedSeconds >= 0) {
          return Math.min(parsedSeconds * 1000, this.#config.maxRetryDelayMs);
        }
      }

      const retryAt = this.parseHttpDate(trimmed);
      if (retryAt !== undefined) {
        return Math.min(Math.max(0, retryAt - Date.now()), this.#config.maxRetryDelayMs);
      }
    }

    // Exponential backoff with Full Jitter
    const base = this.#config.retryDelayMs * Math.pow(2, attempt - 1);
    const capped = Math.min(base, this.#config.maxRetryDelayMs);
    const jitter = 0.5 + Math.random() * 0.5;
    return Math.round(capped * jitter);
  }

  private parseHttpDate(value: string): number | undefined {
    const isHttpDate =
      /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(value) ||
      /^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), \d{2}-(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{2} \d{2}:\d{2}:\d{2} GMT$/.test(value) ||
      /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun) (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) {1,2}\d{1,2} \d{2}:\d{2}:\d{2} \d{4}$/.test(value);
    if (!isHttpDate) return undefined;

    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? timestamp : undefined;
  }

  private async parseResponseBody<T>(
    response: Response,
    endpoint: string,
    method: string
  ): Promise<T> {
    const text = await response.text();
    if (!text || text.trim() === "") {
      return {} as T;
    }

    try {
      return JSON.parse(text) as T;
    } catch (err) {
      throw new ParseError(
        `Failed to parse JSON response from ${endpoint}: ${err instanceof Error ? err.message : String(err)}`,
        text.slice(0, 500),
        { statusCode: response.status, endpoint, method }
      );
    }
  }

  private handleHttpError(
    status: number,
    message: string,
    endpoint: string,
    method: string,
    headers: Headers,
    body: unknown
  ): never {
    const details = {
      statusCode: status,
      endpoint,
      method,
      requestId: headers.get("x-request-id") || headers.get("cf-ray"),
      rawResponse: body,
    };

    if (status === 401) {
      throw new PiaAuthenticationError(message, details);
    }

    if (status === 403) {
      throw new PermissionError(message, undefined, details);
    }

    if (status === 404 && body && typeof body === 'object' && (body as Record<string, unknown>).code === 'ORDER_BOOK_NOT_SUPPORTED') {
      throw new PiaUnsupportedFeatureError(message, details);
    }

    if (status === 429) {
      const retryAfter = headers.get("retry-after");
      const retryAfterSeconds = retryAfter ? parseInt(retryAfter, 10) : undefined;
      throw new PiaRateLimitError(message, {
        retryAfterSeconds: Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : undefined,
        dailyLimit: this.lastRateLimitInfo.dailyLimit,
        dailyRemaining: this.lastRateLimitInfo.dailyRemaining,
        minuteLimit: this.lastRateLimitInfo.limit,
        minuteRemaining: this.lastRateLimitInfo.remaining,
        details,
      });
    }

    throw new PiaApiError(message, status, body, details);
  }

  private sleep(ms: number, signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) return Promise.reject(signal.reason);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        signal?.removeEventListener("abort", onAbort);
        resolve();
      }, ms);
      const onAbort = () => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
        reject(signal?.reason);
      };
      signal?.addEventListener("abort", onAbort, { once: true });
    });
  }
}
