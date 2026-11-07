from celery import shared_task

from apps.market.services.exchange import fetch_exchange_rates
from apps.market.services.gold import fetch_gold_prices
from apps.market.services.oil import fetch_oil_prices
from apps.market.services.stock import fetch_stock_prices


@shared_task(name="apps.market.refresh_quotes")  # type: ignore[untyped-decorator]
def refresh_market_quotes() -> dict[str, int]:
    return {
        "exchange": fetch_exchange_rates(),
        "gold": fetch_gold_prices(),
        "oil": fetch_oil_prices(),
        "stock": fetch_stock_prices(),
    }
