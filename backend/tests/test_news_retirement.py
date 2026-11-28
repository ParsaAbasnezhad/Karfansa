"""Public news and scheduled RSS processing stay retired from the main platform."""

from django.conf import settings
from django.contrib import admin

from apps.news.models import News, NewsSource, NewsTopic
from apps.organization_news.models import OrganizationNews


def test_news_api_is_not_registered(client) -> None:
    assert client.get("/api/v1/news/").status_code == 404
    assert client.get("/api/v1/news/headlines/").status_code == 404


def test_news_has_no_admin_or_beat_entry() -> None:
    for model in (News, NewsSource, NewsTopic, OrganizationNews):
        assert model not in admin.site._registry

    assert all("news" not in name.lower() for name in settings.CELERY_BEAT_SCHEDULE)
    assert all(
        "apps.news" not in entry["task"] for entry in settings.CELERY_BEAT_SCHEDULE.values()
    )


def test_market_module_is_fully_retired(client) -> None:
    assert "apps.market" not in settings.INSTALLED_APPS
    assert "refresh-market-data-every-minute" not in settings.CELERY_BEAT_SCHEDULE
    assert all("apps.market" not in entry["task"] for entry in settings.CELERY_BEAT_SCHEDULE.values())
    assert client.get("/api/v1/market/overview/").status_code == 404
    assert client.get("/api/v1/market/quotes/").status_code == 404
    assert client.get("/api/v1/market/history/").status_code == 404
