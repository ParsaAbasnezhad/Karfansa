"""Status workflow of a news item.

``draft -> pending -> published``; staff may publish a draft directly (publishing on behalf of
a company). Every other jump is rejected with a 409 error.
"""

from datetime import datetime

from django.utils import timezone

from apps.core.workflow import ensure_transition
from apps.organization_news.models import NewsStatus, OrganizationNews

ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    NewsStatus.DRAFT: {NewsStatus.PENDING, NewsStatus.PUBLISHED, NewsStatus.ARCHIVED},
    NewsStatus.PENDING: {NewsStatus.PUBLISHED, NewsStatus.REJECTED, NewsStatus.DRAFT},
    NewsStatus.PUBLISHED: {NewsStatus.ARCHIVED},
    NewsStatus.REJECTED: {NewsStatus.DRAFT, NewsStatus.ARCHIVED},
    NewsStatus.ARCHIVED: {NewsStatus.DRAFT},
}


def _move(news: OrganizationNews, target: NewsStatus) -> None:
    ensure_transition(current=news.status, target=target, allowed=ALLOWED_TRANSITIONS)
    news.status = target


def submit_for_review(news: OrganizationNews) -> OrganizationNews:
    _move(news, NewsStatus.PENDING)
    news.save(update_fields=["status", "updated_at"])
    return news


def publish(news: OrganizationNews, *, now: datetime | None = None) -> OrganizationNews:
    _move(news, NewsStatus.PUBLISHED)
    if news.published_at is None:
        news.published_at = now or timezone.now()
    news.save(update_fields=["status", "published_at", "updated_at"])
    return news


def reject(news: OrganizationNews) -> OrganizationNews:
    _move(news, NewsStatus.REJECTED)
    news.save(update_fields=["status", "updated_at"])
    return news


def archive(news: OrganizationNews) -> OrganizationNews:
    _move(news, NewsStatus.ARCHIVED)
    news.save(update_fields=["status", "updated_at"])
    return news


def return_to_draft(news: OrganizationNews) -> OrganizationNews:
    _move(news, NewsStatus.DRAFT)
    news.save(update_fields=["status", "updated_at"])
    return news
