"""API schemas for editorial news."""

from datetime import datetime

from ninja import Schema

from apps.news.models import News


class NewsItemOut(Schema):
    id: int
    title: str
    summary: str
    source_name: str
    topic: str
    original_url: str
    image_url: str
    published_at: datetime | None
    fetched_at: datetime
    score: int

    @staticmethod
    def resolve_source_name(obj: News) -> str:
        return obj.source.name

    @staticmethod
    def resolve_topic(obj: News) -> str:
        return obj.topic.name


class NewsListOut(Schema):
    results: list[NewsItemOut]
    topics: list[str]
    count: int
    page: int
    page_size: int
    total_pages: int


class HeadlinesOut(Schema):
    featured: NewsItemOut | None
    minis: list[NewsItemOut]
    latest: list[NewsItemOut]
