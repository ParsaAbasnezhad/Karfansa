from apps.market.models import MarketIndicator
from apps.market.services.base import feed_url, fetch_json, save_quotes


def fetch_oil_prices() -> int:
    url = feed_url(MarketIndicator.Category.OIL)
    if not url:
        return 0
    return save_quotes(MarketIndicator.Category.OIL, fetch_json(url), url)
