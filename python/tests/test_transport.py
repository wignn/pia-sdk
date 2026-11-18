"""Unit tests for SyncTransport and AsyncTransport resiliency."""

import asyncio
import unittest
import httpx

from pia import (
    AuthenticationError,
    PermissionError,
    PiaConfig,
    RateLimitError,
    TimeoutError,
)
from pia.transport import SyncTransport, AsyncTransport


class TestHttpTransport(unittest.TestCase):
    def test_headers_and_telemetry_extraction(self):
        captured_headers = {}

        def mock_handler(request: httpx.Request) -> httpx.Response:
            nonlocal captured_headers
            captured_headers = dict(request.headers)
            return httpx.Response(
                200,
                json={"status": "ok"},
                headers={
                    "x-ratelimit-limit": "60",
                    "x-ratelimit-remaining": "58",
                    "x-ratelimit-reset": "2",
                    "x-dailyquota-limit": "1000",
                    "x-dailyquota-remaining": "995",
                },
            )

        mock_client = httpx.Client(transport=httpx.MockTransport(mock_handler))
        config = PiaConfig.resolve(api_key="wi_live_secretkey", headers={"X-App-Env": "prod"})
        transport = SyncTransport(config, client=mock_client)

        res = transport.request("/api/v1/test")
        self.assertEqual(res["status"], "ok")
        self.assertEqual(captured_headers["authorization"], "Bearer wi_live_secretkey")
        self.assertEqual(captured_headers["x-api-key"], "wi_live_secretkey")
        self.assertEqual(captured_headers["x-app-env"], "prod")
        self.assertEqual(captured_headers["user-agent"], "pia-sdk-py/1.3.13")

        telemetry = transport.get_rate_limit_info()
        self.assertEqual(telemetry.limit, 60)
        self.assertEqual(telemetry.remaining, 58)
        self.assertEqual(telemetry.reset_seconds, 2)
        self.assertEqual(telemetry.daily_limit, 1000)
        self.assertEqual(telemetry.daily_remaining, 995)

    def test_authentication_error_without_retry(self):
        call_count = 0

        def mock_handler(request: httpx.Request) -> httpx.Response:
            nonlocal call_count
            call_count += 1
            return httpx.Response(401, json={"error": "Invalid API key"})

        mock_client = httpx.Client(transport=httpx.MockTransport(mock_handler))
        config = PiaConfig.resolve(api_key="bad_key", max_retries=3)
        transport = SyncTransport(config, client=mock_client)

        with self.assertRaises(AuthenticationError):
            transport.request("/api/v1/test")
        self.assertEqual(call_count, 1)

    def test_permission_error_without_retry(self):
        call_count = 0

        def mock_handler(request: httpx.Request) -> httpx.Response:
            nonlocal call_count
            call_count += 1
            return httpx.Response(403, json={"error": "Scope required"})

        mock_client = httpx.Client(transport=httpx.MockTransport(mock_handler))
        config = PiaConfig.resolve(api_key="key", max_retries=3)
        transport = SyncTransport(config, client=mock_client)

        with self.assertRaises(PermissionError):
            transport.request("/api/v1/test")
        self.assertEqual(call_count, 1)

    def test_retry_on_transient_502_error(self):
        call_count = 0

        def mock_handler(request: httpx.Request) -> httpx.Response:
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                return httpx.Response(502, text="Bad Gateway")
            return httpx.Response(200, json={"recovered": True})

        mock_client = httpx.Client(transport=httpx.MockTransport(mock_handler))
        config = PiaConfig.resolve(api_key="key", max_retries=3, retry_delay=0.01)
        transport = SyncTransport(config, client=mock_client)

        res = transport.request("/api/v1/test")
        self.assertTrue(res["recovered"])
        self.assertEqual(call_count, 3)

    def test_rate_limit_error_with_retry_after(self):
        def mock_handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(
                429,
                json={"error": "Daily limit reached"},
                headers={"retry-after": "60", "x-dailyquota-remaining": "0"},
            )

        mock_client = httpx.Client(transport=httpx.MockTransport(mock_handler))
        config = PiaConfig.resolve(api_key="key", max_retries=0)
        transport = SyncTransport(config, client=mock_client)

        with self.assertRaises(RateLimitError) as ctx:
            transport.request("/api/v1/test")

        self.assertEqual(ctx.exception.retry_after_seconds, 60)


class TestHttpTransportRetrySafety(unittest.TestCase):
    def test_fractional_retry_after_uses_fallback_delay(self):
        from pia.transport import _calc_backoff

        config = PiaConfig.resolve(api_key="synthetic", retry_delay=0.008, max_retry_delay=10)
        self.assertLess(_calc_backoff(1, "3.5", config), 0.1)

    def test_non_http_date_retry_after_uses_fallback_delay(self):
        from pia.transport import _calc_backoff

        config = PiaConfig.resolve(api_key="synthetic", retry_delay=0.008, max_retry_delay=10)
        self.assertLess(_calc_backoff(1, "January 1, 2030", config), 0.1)

    def test_sync_post_is_not_retried_after_network_failure(self):
        call_count = 0

        def mock_handler(request: httpx.Request) -> httpx.Response:
            nonlocal call_count
            call_count += 1
            raise httpx.ConnectError("connection reset", request=request)

        client = httpx.Client(transport=httpx.MockTransport(mock_handler))
        transport = SyncTransport(PiaConfig.resolve(api_key="synthetic", max_retries=2), client=client)

        with self.assertRaises(Exception):
            transport.request("/api/v1/write", method="POST", json_data={"value": 1})
        self.assertEqual(call_count, 1)

    def test_sync_post_is_not_retried_after_retryable_response(self):
        call_count = 0

        def mock_handler(request: httpx.Request) -> httpx.Response:
            nonlocal call_count
            call_count += 1
            return httpx.Response(503, text="temporary")

        client = httpx.Client(transport=httpx.MockTransport(mock_handler))
        transport = SyncTransport(PiaConfig.resolve(api_key="synthetic", max_retries=2), client=client)

        with self.assertRaises(Exception):
            transport.request("/api/v1/write", method="POST", json_data={"value": 1})
        self.assertEqual(call_count, 1)


class TestAsyncHttpTransportRetrySafety(unittest.IsolatedAsyncioTestCase):
    async def test_async_post_is_not_retried_after_network_failure(self):
        call_count = 0

        def mock_handler(request: httpx.Request) -> httpx.Response:
            nonlocal call_count
            call_count += 1
            raise httpx.ConnectError("connection reset", request=request)

        client = httpx.AsyncClient(transport=httpx.MockTransport(mock_handler))
        transport = AsyncTransport(PiaConfig.resolve(api_key="synthetic", max_retries=2), client=client)

        with self.assertRaises(Exception):
            await transport.request("/api/v1/write", method="POST", json_data={"value": 1})
        self.assertEqual(call_count, 1)
        await client.aclose()

    async def test_async_post_is_not_retried_after_retryable_response(self):
        call_count = 0

        def mock_handler(request: httpx.Request) -> httpx.Response:
            nonlocal call_count
            call_count += 1
            return httpx.Response(503, text="temporary")

        client = httpx.AsyncClient(transport=httpx.MockTransport(mock_handler))
        transport = AsyncTransport(PiaConfig.resolve(api_key="synthetic", max_retries=2), client=client)

        with self.assertRaises(Exception):
            await transport.request("/api/v1/write", method="POST", json_data={"value": 1})
        self.assertEqual(call_count, 1)
        await client.aclose()

    async def test_cancellation_during_retry_backoff_remains_cancelled(self):
        call_count = 0

        def mock_handler(request: httpx.Request) -> httpx.Response:
            nonlocal call_count
            call_count += 1
            return httpx.Response(503, text="temporary")

        client = httpx.AsyncClient(transport=httpx.MockTransport(mock_handler))
        transport = AsyncTransport(PiaConfig.resolve(api_key="synthetic", max_retries=2, retry_delay=30), client=client)
        pending = asyncio.create_task(transport.request("/api/v1/read", method="GET"))
        for _ in range(100):
            if call_count:
                break
            await asyncio.sleep(0)
        self.assertEqual(call_count, 1)
        await asyncio.sleep(0.01)
        pending.cancel()

        with self.assertRaises(asyncio.CancelledError):
            await pending
        self.assertEqual(call_count, 1)
        await client.aclose()


if __name__ == "__main__":
    unittest.main()
