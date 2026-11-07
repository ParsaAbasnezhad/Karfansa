import pytest

from apps.news import tasks as news_tasks
from apps.news.models import News, NewsSource, NewsTopic
from apps.news.services import rss_fetcher

pytestmark = pytest.mark.django_db


RSS_FEED = """\
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test feed</title>
    <item>
      <title>افزایش قیمت گندم در بازار</title>
      <link>https://news.example/relevant</link>
      <description><![CDATA[<p>بررسی کشت <b>گندم</b></p>]]></description>
      <category>گندم</category>
      <guid>relevant</guid>
    </item>
    <item>
      <title>گزارش تازه درباره وضعیت امروز</title>
      <link>https://news.example/tagged</link>
      <description>گزارش جدید منتشر شد</description>
      <category>گندم</category>
      <guid>tagged</guid>
    </item>
    <item>
      <title>گزارش مسابقه فوتبال امروز</title>
      <link>https://news.example/blocked</link>
      <description>خبر ورزشی</description>
      <guid>blocked</guid>
    </item>
    <item>
      <title>وضعیت آب و هوای فردا</title>
      <link>https://news.example/unrelated</link>
      <description>پیش‌بینی هوا</description>
      <guid>unrelated</guid>
    </item>
  </channel>
</rss>
"""


def test_fetch_source_stores_only_scorer_approved_news(monkeypatch):
    source = NewsSource.objects.create(
        name="Test source",
        rss_url="https://news.example/rss",
    )
    topic = NewsTopic.objects.create(name="کشاورزی", keywords=["گندم", "کشاورزی"])

    monkeypatch.setattr(rss_fetcher, "download_feed", lambda _url: RSS_FEED.encode("utf-8"))

    result = rss_fetcher.fetch_source(source)

    assert result == {"created": 2, "rejected": 2}
    news = News.objects.get(original_url__contains="relevant")
    tagged_news = News.objects.get(original_url__contains="tagged")
    assert news.title == "افزایش قیمت گندم در بازار"
    assert news.topic == topic
    assert news.score > 0
    assert news.summary == "بررسی کشت گندم"
    assert tagged_news.topic == topic
    assert tagged_news.score > 0
    assert News.objects.filter(original_url__contains="blocked").count() == 0
    assert News.objects.filter(original_url__contains="unrelated").count() == 0


def test_news_api_returns_only_approved_rss_items_with_filters(client):
    from django.utils import timezone

    source = NewsSource.objects.create(
        name="Test source",
        rss_url="https://news.example/api-rss",
    )
    agriculture = NewsTopic.objects.create(name="کشاورزی", keywords=["گندم"])
    NewsTopic.objects.create(name="انرژی", keywords=["نفت"])
    News.objects.create(
        source=source,
        topic=agriculture,
        title="قیمت گندم افزایش یافت",
        summary="",
        original_url="https://news.example/wheat",
        score=80,
        published_at=timezone.now(),
    )
    News.objects.create(
        source=source,
        title="خبر بدون تایید",
        summary="",
        original_url="https://news.example/unapproved",
        score=0,
    )
    News.objects.create(
        source=source,
        topic=agriculture,
        title="خبر آرشیوی گندم",
        summary="",
        original_url="https://news.example/archived",
        score=80,
        is_archived=True,
    )

    response = client.get(
        "/api/v1/news/",
        {"topic": "کشاورزی", "q": "گندم"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["count"] == 1
    assert payload["results"][0]["title"] == "قیمت گندم افزایش یافت"
    assert payload["results"][0]["topic"] == "کشاورزی"
    assert payload["results"][0]["source_name"] == source.name
    assert payload["topics"] == ["انرژی", "کشاورزی"]


def test_tasnim_headline_source_is_seeded_and_preferred_on_homepage(client):
    from datetime import timedelta

    from django.utils import timezone

    tasnim_source = NewsSource.objects.get(
        rss_url="https://www.tasnimnews.com/fa/rss/feed/0/8/0/"
    )
    ordinary_source = NewsSource.objects.create(
        name="Other source",
        rss_url="https://news.example/other-rss",
    )
    topic = NewsTopic.objects.create(name="اقتصاد", keywords=["اقتصاد"])
    now = timezone.now()
    News.objects.create(
        source=ordinary_source,
        topic=topic,
        title="خبر عادی تازه‌تر",
        original_url="https://news.example/ordinary",
        published_at=now,
        score=80,
    )
    News.objects.create(
        source=tasnim_source,
        topic=topic,
        title="خبر مهم تسنیم",
        original_url="https://www.tasnimnews.com/fa/news/important",
        published_at=now - timedelta(hours=1),
        score=80,
    )

    response = client.get("/api/v1/news/headlines/")

    assert response.status_code == 200
    payload = response.json()
    assert tasnim_source.is_headline_source is True
    assert payload["featured"]["title"] == "خبر مهم تسنیم"
    assert payload["latest"][0]["title"] == "خبر عادی تازه‌تر"
    assert payload["minis"] == []


def test_scheduled_rss_task_fetches_configured_sources(monkeypatch):
    expected = [{"source": "Tasnim", "status": "success", "created": 3, "rejected": 1}]
    monkeypatch.setattr(news_tasks, "fetch_all_sources", lambda: expected)

    assert news_tasks.fetch_rss_news.run() == expected
