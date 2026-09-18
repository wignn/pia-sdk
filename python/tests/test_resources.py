"""Unit tests for all PIA SDK API resources."""

import unittest
import httpx

from pia import PiaClient


class TestAllResources(unittest.TestCase):
    def test_social_posts_resource(self):
        def mock_handler(request: httpx.Request) -> httpx.Response:
            self.assertIn("/api/v1/social/posts", str(request.url))
            self.assertIn("symbol=BTC", str(request.url))
            return httpx.Response(
                200,
                json={
                    "has_more": False,
                    "items": [
                        {
                            "author_username": "coinbureau",
                            "text": "Bitcoin looking bullish",
                            "url": "https://x.com/coinbureau/123",
                            "created_at": "2026-09-10T10:00:00Z",
                            "platform": "twitter",
                            "like_count": 120,
                            "retweet_count": 45,
                        }
                    ],
                },
            )

        client = PiaClient(
            api_key="test",
            http_client=httpx.Client(transport=httpx.MockTransport(mock_handler)),
        )
        res = client.social.get_posts(symbol="btc")
        self.assertFalse(res.has_more)
        self.assertEqual(len(res.items), 1)
        self.assertEqual(res.items[0].author_username, "coinbureau")
        self.assertEqual(res.items[0].like_count, 120)

    def test_intelligence_resource(self):
        def mock_handler(request: httpx.Request) -> httpx.Response:
            if "/api/v1/intelligence/analyze" in str(request.url):
                return httpx.Response(
                    200,
                    json={
                        "symbol": "BTCUSDT",
                        "sentiment": "bullish",
                        "analysis": "Institutional accumulation active.",
                    },
                )
            if "/api/v1/market/insights" in str(request.url):
                return httpx.Response(
                    200,
                    json={"symbol": "AAPL", "summary": "Strong iPhone demand."},
                )
            return httpx.Response(404)

        client = PiaClient(
            api_key="test",
            http_client=httpx.Client(transport=httpx.MockTransport(mock_handler)),
        )
        analysis = client.intelligence.analyze(symbol="BTCUSDT")
        self.assertEqual(analysis["sentiment"], "bullish")

        insight = client.intelligence.get_insights("AAPL")
        self.assertEqual(insight["symbol"], "AAPL")

    def test_options_resource(self):
        def mock_handler(request: httpx.Request) -> httpx.Response:
            if "/api/v1/options/chain" in str(request.url):
                self.assertIn("symbol=NVDA", str(request.url))
                return httpx.Response(
                    200,
                    json={
                        "symbol": "NVDA",
                        "underlying_price": 125.4,
                        "expirations": ["2026-09-18"],
                        "contracts": [],
                    },
                )
            if "/api/v1/options/gex" in str(request.url):
                self.assertIn("symbol=SPX", str(request.url))
                return httpx.Response(
                    200,
                    json={
                        "symbol": "SPX",
                        "net_gex": 150000000.0,
                        "zero_gamma_level": 5600.0,
                    },
                )
            return httpx.Response(404)

        client = PiaClient(
            api_key="test",
            http_client=httpx.Client(transport=httpx.MockTransport(mock_handler)),
        )
        chain = client.options.get_chain("nvda")
        self.assertEqual(chain.symbol, "NVDA")
        self.assertEqual(chain.underlying_price, 125.4)

        gex = client.options.get_gex("spx")
        self.assertEqual(gex.symbol, "SPX")
        self.assertEqual(gex.net_gex, 150000000.0)

    def test_sec_and_energy_and_geosignals_resource(self):
        def mock_handler(request: httpx.Request) -> httpx.Response:
            if "/api/v1/sec/filings" in str(request.url):
                return httpx.Response(
                    200,
                    json={"total": 1, "items": [{"id": "1", "symbol": "MSFT", "form_type": "10-K"}]},
                )
            if "/api/v1/energy/dashboard" in str(request.url):
                return httpx.Response(
                    200,
                    json={"crude_oil": {"wti_price": 75.2}},
                )
            if "/api/v1/geosignals" in str(request.url):
                return httpx.Response(
                    200,
                    json={"total": 1, "events": [{"id": "geo-1", "title": "Strait of Malacca Alert"}]},
                )
            return httpx.Response(404)

        client = PiaClient(
            api_key="test",
            http_client=httpx.Client(transport=httpx.MockTransport(mock_handler)),
        )
        filings = client.sec.get_filings(symbol="MSFT")
        self.assertEqual(filings["total"], 1)

        energy = client.energy.get_dashboard()
        self.assertEqual(energy["crude_oil"]["wti_price"], 75.2)

        geo = client.geosignals.get_events()
        self.assertEqual(geo["total"], 1)

    def test_market_extensions(self):
        def mock_handler(request: httpx.Request) -> httpx.Response:
            if "/api/v1/market/trading-halts" in str(request.url):
                return httpx.Response(200, json={"halts": []})
            if "/api/v1/market/corporate-actions" in str(request.url):
                return httpx.Response(200, json={"actions": []})
            return httpx.Response(404)

        client = PiaClient(
            api_key="test",
            http_client=httpx.Client(transport=httpx.MockTransport(mock_handler)),
        )
        halts = client.market.get_trading_halts()
        self.assertEqual(halts["halts"], [])

        actions = client.market.get_corporate_actions()
        self.assertEqual(actions["actions"], [])

    def test_macro_map_resource(self):
        def mock_handler(request: httpx.Request) -> httpx.Response:
            self.assertIn("/api/v1/economic/map", str(request.url))
            self.assertIn("indicator=inflation", str(request.url))
            return httpx.Response(
                200,
                json={
                    "indicator": "inflation",
                    "indicator_name": "Inflation Rate",
                    "unit": "Percent",
                    "period": "2026-08",
                    "min_value": 0.5,
                    "max_value": 30.0,
                    "timeline": ["2026-07", "2026-08"],
                    "total": 2,
                    "countries": [
                        {"country_code": "CA", "country_name": "Canada", "value": 3.0, "rank": 1},
                        {"country_code": "ID", "country_name": "Indonesia", "value": 3.19, "rank": 2},
                    ],
                },
            )

        client = PiaClient(
            api_key="test",
            http_client=httpx.Client(transport=httpx.MockTransport(mock_handler)),
        )
        res = client.economic.get_macro_map(indicator="inflation", period="2026-08")
        self.assertEqual(res.indicator, "inflation")
        self.assertEqual(res.min_value, 0.5)
        self.assertEqual(res.max_value, 30.0)
        self.assertEqual(res.countries[0].country_code, "CA")
        self.assertEqual(res.countries[0].value, 3.0)
        self.assertEqual(res.countries[1].country_name, "Indonesia")

    def test_macro_map_preserves_none_min_max_values(self):
        from pia.types import MacroMapResponse

        # Explicit None in payload
        data_none = {
            "indicator": "unemployment",
            "indicator_name": "Unemployment Rate",
            "unit": "Percent",
            "period": "2026-08",
            "min_value": None,
            "max_value": None,
            "total": 0,
            "timeline": [],
            "countries": [],
        }
        res_none = MacroMapResponse.from_dict(data_none)
        self.assertIsNone(res_none.min_value)
        self.assertIsNone(res_none.max_value)
        self.assertEqual(res_none.total, 0)

        # Missing keys in payload
        data_missing = {
            "indicator": "pmi",
            "indicator_name": "Manufacturing PMI",
            "unit": "Index",
            "period": "2026-08",
            "timeline": [],
            "countries": [],
        }
        res_missing = MacroMapResponse.from_dict(data_missing)
        self.assertIsNone(res_missing.min_value)
        self.assertIsNone(res_missing.max_value)
        self.assertEqual(res_missing.total, 0)


if __name__ == "__main__":
    unittest.main()
