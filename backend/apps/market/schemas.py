from datetime import datetime
from decimal import Decimal

from ninja import Schema


class MarketPricePointOut(Schema):
    value: Decimal
    change_percent: Decimal | None
    observed_at: datetime


class MarketQuoteOut(Schema):
    category: str
    symbol: str
    name: str
    value: Decimal
    currency: str
    unit: str
    change_percent: Decimal | None
    source: str
    observed_at: datetime
    is_featured: bool = False
    history: list[MarketPricePointOut] = []


class MarketQuotesOut(Schema):
    results: list[MarketQuoteOut]


class MarketProviderOut(Schema):
    name: str
    website_url: str
    rest_base_url: str
    websocket_url: str
    rest_requests_per_minute: int
    websocket_connections: int
    subscription_pricing: str
    coverage: list[str]
    configured: bool


class MarketOverviewOut(Schema):
    results: list[MarketQuoteOut]
    provider: MarketProviderOut


class MarketHistoryOut(Schema):
    category: str
    symbol: str
    name: str
    currency: str
    unit: str
    results: list[MarketPricePointOut]
