import os

from django.db.models import Prefetch
from django.http import HttpRequest
from django.shortcuts import get_object_or_404
from ninja import Router

from apps.market.models import MarketDataProvider, MarketIndicator, MarketPrice
from apps.market.schemas import (
    MarketHistoryOut,
    MarketOverviewOut,
    MarketProviderOut,
    MarketQuotesOut,
)
from apps.market.services.base import feed_url

router = Router()


@router.get("/quotes/", response=MarketQuotesOut, operation_id="market_quotes_list")
def list_quotes(request: HttpRequest, category: str = "") -> dict[str, object]:
    return {"results": quote_results(category)}


def quote_results(category: str = "") -> list[dict[str, object]]:
    indicators = MarketIndicator.objects.filter(is_active=True).prefetch_related(
        Prefetch(
            "prices",
            queryset=MarketPrice.objects.order_by("-observed_at", "-pk")[:20],
            to_attr="recent_prices",
        )
    )
    if category:
        indicators = indicators.filter(category=category)
    results = []
    for indicator in indicators:
        prices = indicator.recent_prices
        if not prices:
            continue
        latest = prices[0]
        results.append(
            {
                "category": indicator.category,
                "symbol": indicator.symbol,
                "name": indicator.name,
                "value": latest.value,
                "currency": indicator.currency,
                "unit": indicator.unit,
                "change_percent": latest.change_percent,
                "source": latest.source,
                "observed_at": latest.observed_at,
                "is_featured": indicator.is_featured,
                "history": list(reversed(prices)),
            }
        )
    return results


def _provider_configured(provider: MarketDataProvider | None) -> bool:
    key = (
        provider.api_key if provider and provider.api_key else os.environ.get("MARKET_API_KEY", "")
    )
    categories = (
        MarketIndicator.Category.EXCHANGE,
        MarketIndicator.Category.GOLD,
        MarketIndicator.Category.OIL,
        MarketIndicator.Category.STOCK,
    )
    return bool(key and all(feed_url(category) for category in categories))


def provider_details() -> dict[str, object]:
    provider = MarketDataProvider.objects.filter(is_active=True).first()
    if provider:
        return {
            "name": provider.name,
            "website_url": provider.website_url,
            "rest_base_url": provider.rest_base_url,
            "websocket_url": provider.websocket_url,
            "rest_requests_per_minute": provider.rest_requests_per_minute,
            "websocket_connections": provider.websocket_connections,
            "subscription_pricing": provider.subscription_pricing,
            "coverage": provider.coverage,
            "configured": _provider_configured(provider),
        }
    return {
        "name": "StreamData",
        "website_url": "https://streamdata.ir",
        "rest_base_url": "",
        "websocket_url": "",
        "rest_requests_per_minute": 60,
        "websocket_connections": 5,
        "subscription_pricing": ("برای اطلاع از هزینه اشتراک با ارائه‌دهنده استعلام کنید."),
        "coverage": [
            "دلار و طلا در بازار ایران",
            "شاخص‌ها و سهام بورس تهران",  # noqa: RUF001
            "نفت و کالاهای جهانی",
            "داده تاریخی و لحظه‌ای",
            "REST API و WebSocket",
        ],
        "configured": _provider_configured(None),
    }


@router.get("/overview/", response=MarketOverviewOut, operation_id="market_overview")
def market_overview(request: HttpRequest) -> dict[str, object]:
    return {"results": quote_results(), "provider": provider_details()}


@router.get("/provider/", response=MarketProviderOut, operation_id="market_provider_details")
def market_provider(request: HttpRequest) -> dict[str, object]:
    return provider_details()


@router.get("/history/", response=MarketHistoryOut, operation_id="market_price_history")
def market_history(
    request: HttpRequest, symbol: str, category: str, limit: int = 100
) -> dict[str, object]:
    indicator = get_object_or_404(MarketIndicator, category=category, symbol=symbol, is_active=True)
    prices = MarketPrice.objects.filter(indicator=indicator).order_by("-observed_at", "-pk")[
        : max(1, min(limit, 500))
    ]
    return {
        "category": indicator.category,
        "symbol": indicator.symbol,
        "name": indicator.name,
        "currency": indicator.currency,
        "unit": indicator.unit,
        "results": list(reversed(list(prices))),
    }
