"""API endpoints for editorial news."""

from math import ceil

from django.http import HttpRequest
from ninja import Query, Router

from apps.news import selectors
from apps.news.schemas import HeadlinesOut, NewsListOut

router = Router()


@router.get("/headlines/", response=HeadlinesOut, operation_id="news_headlines")
def news_headlines(request: HttpRequest) -> dict[str, object]:
    headlines = selectors.list_headline_news()
    latest = selectors.list_rss_news()
    featured = headlines.first()
    return {
        "featured": featured,
        "minis": (
            headlines.filter(source_id=featured.source_id)
            .exclude(pk=featured.pk)[:2]
            if featured
            else []
        ),
        "latest": latest[:6],
    }


@router.get("/", response=NewsListOut, operation_id="news_list")
def list_news(
    request: HttpRequest,
    topic: str = "",
    q: str = "",
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=50),
) -> dict[str, object]:
    news = selectors.list_rss_news(topic=topic.strip(), query=q.strip())
    count = news.count()
    start = (page - 1) * page_size
    return {
        "results": news[start : start + page_size],
        "topics": list(selectors.list_active_topics().values_list("name", flat=True)),
        "count": count,
        "page": page,
        "page_size": page_size,
        "total_pages": ceil(count / page_size),
    }
