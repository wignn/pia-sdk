"""Unit tests for Social, News, Options, Macro, and Ws resources."""

import unittest
import httpx

from pia import PiaClient


class TestOtherResources(unittest.TestCase):
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

    def test_options_resource(self):
        def mock_handler(request: httpx.Request) -> httpx.Response:
            if "/api/v1/options/chain" in str(request.url):
                self.assertIn("/api/v1/options/chain/NVDA", str(request.url))
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
                self.assertIn("/api/v1/options/gex/SPX", str(request.url))
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

    def test_macro_resource(self):
        def mock_handler(request: httpx.Request) -> httpx.Response:
            if "/api/v1/fear-greed" in str(request.url):
                return httpx.Response(
                    200,
                    json={
                        "score": 68.5,
                        "rating": "greed",
                        "timestamp": "2026-09-13T12:00:00Z",
                    },
                )
            if "/api/v1/cot/symbol" in str(request.url):
                self.assertIn("GOLD", str(request.url))
                return httpx.Response(
                    200,
                    json={
                        "symbol": "GOLD",
                        "reports": [
                            {
                                "market_code": "088691",
                                "report_date": "2026-09-08",
                                "commercial_long": 100000,
                                "commercial_short": 250000,
                            }
                        ],
                    },
                )
            return httpx.Response(404)

        client = PiaClient(
            api_key="test",
            http_client=httpx.Client(transport=httpx.MockTransport(mock_handler)),
        )
        fg = client.macro.get_fear_greed()
        self.assertEqual(fg.score, 68.5)
        self.assertEqual(fg.rating, "greed")

        cot = client.macro.get_cot("gold")
        self.assertEqual(len(cot.reports), 1)
        self.assertEqual(cot.reports[0].commercial_long, 100000)

    def test_news_resource(self):
        def mock_handler(request: httpx.Request) -> httpx.Response:
            self.assertIn("/api/v1/news", str(request.url))
            self.assertIn("symbols=XAUUSD%2CBTC", str(request.url))
            return httpx.Response(
                200,
                json={
                    "total": 1,
                    "items": [
                        {
                            "id": "news-1",
                            "title": "Gold reaches new highs",
                            "summary": "Market analysis on gold...",
                            "url": "https://news.wign.dev/1",
                            "source": "Bloomberg",
                            "published_at": "2026-09-10T10:00:00Z",
                        }
                    ],
                },
            )

        client = PiaClient(
            api_key="test",
            http_client=httpx.Client(transport=httpx.MockTransport(mock_handler)),
        )
        res = client.news.get_news(symbols=["xauusd", "btc"])
        self.assertEqual(res.total, 1)
        self.assertEqual(res.items[0].source, "Bloomberg")

    def test_ws_ticket_resource(self):
        def mock_handler(request: httpx.Request) -> httpx.Response:
            self.assertIn("/api/v1/ws/ticket", str(request.url))
            self.assertEqual(request.method, "POST")
            return httpx.Response(
                200,
                json={"ticket": "wst_abcdef12345", "expires_in": 60},
            )

        client = PiaClient(
            api_key="test",
            http_client=httpx.Client(transport=httpx.MockTransport(mock_handler)),
        )
        res = client.ws.create_ticket()
        self.assertEqual(res.ticket, "wst_abcdef12345")
        self.assertEqual(res.expires_in, 60)


if __name__ == "__main__":
    unittest.main()
