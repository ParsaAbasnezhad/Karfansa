"""Shared helpers for fetching and normalizing market data feeds."""

import logging
import os
from datetime import datetime
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from typing import Any

import requests
from django.utils import timezone

from apps.market.models import MarketDataProvider, MarketIndicator, MarketPrice

TIMEOUT = 15
logger = logging.getLogger(__name__)


def fetch_json(url: str) -> Any:
    provider = MarketDataProvider.objects.filter(is_active=True).first()
    headers = {"User-Agent": "KarfansaMarket/1.0"}
    api_key = provider.api_key if provider else ""
    api_key = api_key or os.environ.get("MARKET_API_KEY", "")
    if api_key:
        header = (
            provider.api_key_header
            if provider and provider.api_key
            else os.environ.get("MARKET_API_KEY_HEADER", "Authorization")
        )
        prefix = (
            provider.api_key_prefix
            if provider and provider.api_key
            else os.environ.get("MARKET_API_KEY_PREFIX", "Bearer")
        )
        headers[header] = f"{prefix} {api_key}".strip()
    response = requests.get(url, timeout=TIMEOUT, headers=headers)
    response.raise_for_status()
    return response.json()


def _records(payload: Any) -> list[Any]:
    if isinstance(payload, list):
        return payload
    if not isinstance(payload, dict):
        return []
    records = payload.get("data", payload.get("results", []))
    if isinstance(records, dict):
        records = records.get("items", records.get("results", []))
    return records if isinstance(records, list) else []


def _decimal(value: Any, *, places: int, max_digits: int, positive: bool = False) -> Decimal | None:
    if value is None:
        return None
    digits = "۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩"
    text = str(value).translate(str.maketrans(digits, "01234567890123456789"))
    text = text.strip().replace(",", "").replace("٬", "").replace("٫", ".")  # noqa: RUF001
    text = text.removesuffix("%").strip()
    try:
        number = Decimal(text).quantize(Decimal(1).scaleb(-places), rounding=ROUND_HALF_UP)
    except (InvalidOperation, ValueError):
        return None
    if not number.is_finite() or (positive and number <= 0):
        return None
    if len(number.as_tuple().digits) > max_digits:
        return None
    return number


def _observed_at(value: Any) -> datetime | None:
    if value is None or value == "":
        return timezone.now()
    if not isinstance(value, str):
        return None
    try:
        observed_at = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return timezone.make_aware(observed_at) if timezone.is_naive(observed_at) else observed_at


def save_quotes(category: str, payload: Any, source: str) -> int:
    """Validate provider records and idempotently store historical prices."""
    count = 0
    for record in _records(payload):
        if not isinstance(record, dict):
            continue
        symbol = str(record.get("symbol") or record.get("code") or "").strip()
        name = str(record.get("name") or symbol).strip()
        value = _decimal(
            record.get("value", record.get("price")),
            places=6,
            max_digits=24,
            positive=True,
        )
        if not symbol or value is None:
            continue
        observed_at = _observed_at(record.get("observed_at") or record.get("timestamp"))
        if observed_at is None:
            continue
        change = _decimal(record.get("change_percent"), places=4, max_digits=10)
        indicator, _ = MarketIndicator.objects.update_or_create(
            category=category,
            symbol=symbol,
            defaults={
                "name": name,
                "currency": str(record.get("currency") or "IRR").strip(),
                "unit": str(record.get("unit") or "").strip(),
            },
        )
        if change is None:
            previous = (
                MarketPrice.objects.filter(indicator=indicator, observed_at__lt=observed_at)
                .order_by("-observed_at")
                .first()
            )
            if previous:
                change = _decimal(
                    (value - previous.value) * Decimal(100) / previous.value,
                    places=4,
                    max_digits=10,
                )
        MarketPrice.objects.update_or_create(
            indicator=indicator,
            observed_at=observed_at,
            defaults={"value": value, "change_percent": change, "source": source},
        )
        count += 1
    if not count:
        logger.warning("No valid %s market records were received from %s", category, source)
    return count


def feed_url(category: str) -> str:
    provider = MarketDataProvider.objects.filter(is_active=True).first()
    env_url = os.environ.get(f"MARKET_{category.upper()}_URL", "")
    if env_url:
        return env_url
    if provider and provider.rest_base_url:
        suffix = "stocks" if category == MarketIndicator.Category.STOCK else category
        return f"{provider.rest_base_url.rstrip('/')}/{suffix}"
    return ""
