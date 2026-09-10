# pip install piaa-sdk
from pia import PiaClient, RateLimitError, AuthenticationError

client = PiaClient(api_key="wi_live_9a4f5e170b8e6d870ec3628bd21a1196da8ec1a18a17e3b7")

try:
    # 1. Fetch live multi-asset snapshot (105+ instruments)
    prices = client.market.get_prices()
    print(f"Total assets tracked: {prices.total}")
    for item in prices.items[:5]:
        print(f"[{item.symbol}] Price: ${item.price} ({item.asset_type})")

    # 2. Fetch historical candlesticks
    candles = client.market.get_candles("XAUUSD", timeframe="1m", limit=5)
    print(f"Retrieved {candles.count} candles for {candles.symbol}")

    # 3. Check rate limit telemetry
    quota = client.get_rate_limit_info()
    print(f"Remaining daily quota: {quota.daily_remaining}/{quota.daily_limit}")

except RateLimitError as e:
    print(f"Rate limit exceeded! Retry after {e.retry_after_seconds}s")
except AuthenticationError:
    print("Invalid or inactive API key.")
finally:
    client.close()
