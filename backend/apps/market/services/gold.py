from apps.market.models import MarketIndicator
from apps.market.services.base import feed_url, fetch_json, save_quotes


def fetch_gold_prices() -> int:
    url = feed_url(MarketIndicator.Category.GOLD)
    if not url:
        return 0
    return save_quotes(MarketIndicator.Category.GOLD, fetch_json(url), url)
