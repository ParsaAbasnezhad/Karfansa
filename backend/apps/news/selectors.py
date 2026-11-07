"""Read queries for editorial news."""

from django.db.models import Case, IntegerField, QuerySet, Value, When
from django.db.models.functions import Coalesce

from apps.news.models import News, NewsTopic


def list_rss_news(*, topic: str = "", query: str = "") -> QuerySet[News]:
    """Return scorer-approved RSS news for the public news listing."""
    news = (
        News.objects.filter(
            topic__isnull=False,
            topic__is_active=True,
            score__gt=0,
            is_archived=False,
        )
        .select_related("source", "topic")
        .annotate(_sort_date=Coalesce("published_at", "fetched_at"))
        .order_by("-_sort_date", "-id")
    )
    if topic:
        news = news.filter(topic__name=topic)
    if query:
        news = news.filter(title__icontains=query)
    return news


def list_active_topics() -> QuerySet[NewsTopic]:
    return NewsTopic.objects.filter(is_active=True).order_by("name")


def list_headline_news() -> QuerySet[News]:
    return list_rss_news().annotate(
        _source_rank=Case(
            When(source__is_headline_source=True, then=Value(0)),
            default=Value(1),
            output_field=IntegerField(),
        )
    ).order_by("_source_rank", "-_sort_date", "-id")
