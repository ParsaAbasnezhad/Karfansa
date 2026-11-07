from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from apps.market.models import MarketDataProvider, MarketIndicator, MarketPrice
from apps.market.services import base as market_service

pytestmark = pytest.mark.django_db


def test_save_quotes_validates_and_keeps_idempotent_price_history():
    first_time = timezone.now() - timedelta(minutes=2)
    latest_time = timezone.now() - timedelta(minutes=1)
    records = [
        {
            "symbol": "USD",
            "name": "دلار",
            "price": "۱٬۰۰۰٫۵",  # noqa: RUF001
            "currency": "IRR",
            "unit": "تومان",
            "observed_at": first_time.isoformat(),
        },
        {
            "symbol": "USD",
            "name": "دلار",
            "price": "1050",
            "currency": "IRR",
            "unit": "تومان",
            "observed_at": latest_time.isoformat(),
        },
        {"symbol": "INVALID", "price": "NaN", "observed_at": latest_time.isoformat()},
        {"symbol": "BAD-DATE", "price": "1", "observed_at": "not a date"},
    ]

    assert market_service.save_quotes(MarketIndicator.Category.EXCHANGE, records, "feed") == 2
    assert market_service.save_quotes(MarketIndicator.Category.EXCHANGE, records, "feed") == 2

    indicator = MarketIndicator.objects.get(symbol="USD")
    prices = list(indicator.prices.order_by("observed_at"))
    assert len(prices) == 2
    assert prices[0].value == Decimal("1000.500000")
    assert prices[1].value == Decimal("1050.000000")
    assert prices[1].change_percent == Decimal("4.9475")
    assert MarketIndicator.objects.count() == 1


def test_market_overview_and_history_api_return_latest_and_chronological_points(client):
    indicator = MarketIndicator.objects.create(
        category=MarketIndicator.Category.GOLD,
        symbol="GOLD18",
        name="طلای ۱۸ عیار",
        currency="IRR",
        unit="گرم",
        is_featured=True,
    )
    now = timezone.now()
    for index, value in enumerate(("10", "20", "30")):
        MarketPrice.objects.create(
            indicator=indicator,
            value=Decimal(value),
            observed_at=now + timedelta(minutes=index),
            source="StreamData",
        )

    overview = client.get("/api/v1/market/overview/")
    assert overview.status_code == 200
    quote = overview.json()["results"][0]
    assert quote["symbol"] == "GOLD18"
    assert quote["value"] == "30.000000"
    assert quote["is_featured"] is True
    assert [point["value"] for point in quote["history"]] == [
        "10.000000",
        "20.000000",
        "30.000000",
    ]

    history = client.get(
        "/api/v1/market/history/",
        {"category": "gold", "symbol": "GOLD18", "limit": 2},
    )
    assert history.status_code == 200
    assert [point["value"] for point in history.json()["results"]] == [
        "20.000000",
        "30.000000",
    ]


def test_market_provider_uses_configured_auth_header(monkeypatch):
    provider = MarketDataProvider.objects.create(
        name="StreamData",
        api_key="test-key",
        api_key_header="X-API-Key",
        api_key_prefix="",
    )
    captured: dict[str, object] = {}

    class Response:
        def raise_for_status(self):
            pass

        def json(self):
            return {"data": []}

    def fake_get(url, *, timeout, headers):
        captured.update({"url": url, "timeout": timeout, "headers": headers})
        return Response()

    monkeypatch.setattr(market_service.requests, "get", fake_get)

    assert market_service.fetch_json("https://api.example.test/prices") == {"data": []}
    assert captured["headers"]["X-API-Key"] == "test-key"
    provider.delete()
