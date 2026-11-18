"""Unit tests for Realtime streaming In-Band Auth and event dispatch."""

import asyncio
import json
import unittest
from unittest.mock import patch

from pia import MarketPrice, PiaConfig
from pia.realtime import AsyncRealtimeClient


class TestRealtimeClient(unittest.IsolatedAsyncioTestCase):
    async def test_in_band_auth_and_tick_processing(self):
        config = PiaConfig.resolve(api_key="synthetic_test_key")
        client = AsyncRealtimeClient(config)
        auth_received = False
        captured_tick: MarketPrice | None = None

        def on_auth(info):
            nonlocal auth_received
            auth_received = True

        def on_tick(tick: MarketPrice):
            nonlocal captured_tick
            captured_tick = tick

        client.on("authenticated", on_auth)
        client.on("tick", on_tick)
        await client._handle_raw_message(json.dumps({"event": "authenticated", "data": {"plan": "starter"}}))
        self.assertTrue(auth_received)
        await client._handle_raw_message(json.dumps({"event": "market.trade", "data": {"tick": {
            "symbol": "XAUUSD", "price": 2515.50, "bid": 2515.40, "ask": 2515.60,
        }}}))
        self.assertIsNotNone(captured_tick)
        self.assertEqual(captured_tick.symbol, "XAUUSD")
        self.assertEqual(captured_tick.price, 2515.50)

    async def test_symbol_subscription_queue(self):
        config = PiaConfig.resolve(api_key="synthetic_test_key")
        client = AsyncRealtimeClient(config)
        client.subscribe(["XAUUSD", "btcusdt", "   "])
        self.assertIn("XAUUSD", client.subscribed_symbols)
        self.assertIn("BTCUSDT", client.subscribed_symbols)
        self.assertEqual(len(client.subscribed_symbols), 2)

    async def test_market_price_retains_receipt_time_and_provider_source(self):
        tick = MarketPrice.from_dict({
            "symbol": "XAUUSD", "price": 2500,
            "received_at": "2026-11-18T00:00:00Z", "provider_source": "ctrader_fix",
        })
        self.assertEqual(tick.received_at, "2026-11-18T00:00:00Z")
        self.assertEqual(tick.provider_source, "ctrader_fix")

    async def test_market_freshness_advances_on_ticks_not_pongs(self):
        client = AsyncRealtimeClient(PiaConfig.resolve(api_key="synthetic_test_key"))
        client._is_authenticated = True
        ticks = []
        client.on("tick", ticks.append)
        await client._handle_raw_message(json.dumps({"event": "pong"}))
        self.assertGreater(client.last_pong_at, 0)
        self.assertEqual(client.last_market_event_at, 0)
        await client._handle_raw_message(json.dumps({"event": "market.tick", "data": {
            "symbol": "XAUUSD", "price": 2500, "bid": 2499, "ask": 2501,
            "received_at": "2026-11-18T00:00:00Z", "provider_source": "ctrader_fix",
        }}))
        self.assertGreater(client.last_market_event_at, 0)
        self.assertEqual(ticks[0].symbol, "XAUUSD")

    async def test_close_clears_authentication(self):
        client = AsyncRealtimeClient(PiaConfig.resolve(api_key="synthetic_test_key"))
        client._is_authenticated = True
        await client.close()
        self.assertFalse(client._is_authenticated)

    async def test_freshness_callbacks_are_observable(self):
        client = AsyncRealtimeClient(PiaConfig.resolve(api_key="synthetic_test_key"))
        client._is_authenticated = True
        pongs, activity = [], []
        client.on("pong", pongs.append)
        client.on("market_activity", activity.append)
        await client._handle_raw_message('{"event":"pong"}')
        await client._handle_raw_message(json.dumps({
            "event": "market.tick", "data": {"symbol": "XAUUSD", "price": 2500},
        }))
        self.assertEqual(len(pongs), 1)
        self.assertEqual(len(activity), 1)
        self.assertEqual(activity[0]["symbol"], "XAUUSD")

    async def test_requires_authentication_before_forwarding_market_data(self):
        client = AsyncRealtimeClient(PiaConfig.resolve(api_key="synthetic_test_key"))
        ticks = []
        client.on("tick", ticks.append)
        await client._handle_raw_message(json.dumps({"event": "market.tick", "data": {
            "symbol": "XAUUSD", "price": 2500,
        }}))
        self.assertEqual(ticks, [])

    async def test_closed_socket_reconnects_with_backoff_and_resubscribes_after_auth(self):
        client = AsyncRealtimeClient(PiaConfig.resolve(api_key="synthetic_test_key"))
        client.subscribed_symbols.add("XAUUSD")
        connections = 0
        subscriptions = []

        class FakeSocket:
            def __init__(self, disconnect_after_auth):
                self.disconnect_after_auth = disconnect_after_auth
                self.messages = iter([json.dumps({"event": "authenticated"})])
                self.close_next = False

            async def __aenter__(self):
                return self

            async def __aexit__(self, exc_type, exc, tb):
                return False

            async def close(self):
                pass

            async def send(self, frame):
                payload = json.loads(frame)
                if payload.get("action") == "subscribe":
                    subscriptions.append(payload["symbols"])
                    self.close_next = self.disconnect_after_auth

            def __aiter__(self):
                return self

            async def __anext__(self):
                if self.messages is not None:
                    try:
                        return next(self.messages)
                    except StopIteration:
                        self.messages = None
                if self.close_next:
                    self.close_next = False
                    raise StopAsyncIteration
                if self.disconnect_after_auth and self.messages is None:
                    raise StopAsyncIteration
                await asyncio.Event().wait()

        def fake_connect(*args, **kwargs):
            nonlocal connections
            connections += 1
            return FakeSocket(disconnect_after_auth=True)

        waits = []

        async def fake_sleep(delay):
            waits.append(delay)
            if connections >= 2:
                client._is_closed = True

        with patch("pia.realtime.websockets.connect", new=fake_connect), patch(
            "pia.realtime.asyncio.sleep", new=fake_sleep
        ):
            await client.listen()

        self.assertEqual(connections, 2)
        self.assertTrue(waits)
        self.assertEqual(subscriptions, [["XAUUSD"], ["XAUUSD"]])

    async def test_authentication_deadline_closes_silent_socket(self):
        class SilentSocket:
            def __init__(self): self.sent = []; self.closed = False
            async def send(self, frame): self.sent.append(frame)
            def __aiter__(self): return self
            async def __anext__(self): await asyncio.Event().wait()
            async def close(self): self.closed = True
        sock = SilentSocket()
        client = AsyncRealtimeClient(PiaConfig.resolve(api_key="synthetic_test_key", timeout=0.1, max_retries=0))
        attempts = 0

        class FakeConnect:
            def __init__(self, socket): self.socket = socket
            async def __aenter__(self): return self.socket
            async def __aexit__(self, exc_type, exc, tb): return False
        def fake_connect(*args, **kwargs):
            nonlocal attempts
            attempts += 1
            if attempts == 1:
                return FakeConnect(sock)
            raise AssertionError("authentication timeout must not start another connection")

        async def stop_after_retry(delay):
            client._is_closed = True

        with patch("pia.realtime.websockets.connect", new=fake_connect), patch(
            "pia.realtime.asyncio.sleep", new=stop_after_retry
        ):
            await client.listen()
        self.assertTrue(sock.closed)
        self.assertTrue(sock.sent)
        self.assertFalse(client._is_authenticated)


if __name__ == "__main__":
    unittest.main()
