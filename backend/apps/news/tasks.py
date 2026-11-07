"""Background tasks for editorial news."""

from celery import shared_task

from apps.news.services.rss_fetcher import fetch_all_sources


@shared_task(name="apps.news.fetch_rss_news")
def fetch_rss_news() -> list[dict[str, object]]:
    """Fetch and filter configured RSS feeds for public news listings."""
    return fetch_all_sources()
