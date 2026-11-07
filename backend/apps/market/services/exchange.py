from apps.market.models import MarketIndicator
from apps.market.services.base import feed_url, fetch_json, save_quotes


def fetch_exchange_rates() -> int:
    url = feed_url(MarketIndicator.Category.EXCHANGE)
    if not url:
        return 0
    return save_quotes(MarketIndicator.Category.EXCHANGE, fetch_json(url), url)
