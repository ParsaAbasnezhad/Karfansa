from datetime import timedelta

import pytest
from django.db import IntegrityError, transaction
from django.test import Client
from django.utils import timezone

from apps.core.errors import ApiError
from apps.organization_news import services
from apps.organization_news.models import NewsStatus
from tests.factories import make_news, make_organization

pytestmark = pytest.mark.django_db


def test_happy_path_draft_to_published_sets_the_date() -> None:
    news = make_news(make_organization())

    services.submit_for_review(news)
    assert news.status == NewsStatus.PENDING
    assert news.published_at is None

    services.publish(news)
    news.refresh_from_db()
    assert news.status == NewsStatus.PUBLISHED
    assert news.published_at is not None


def test_staff_can_publish_a_draft_directly() -> None:
    news = services.publish(make_news(make_organization()))

    assert news.status == NewsStatus.PUBLISHED


@pytest.mark.parametrize(
    ("start", "action"),
    [
        (NewsStatus.PUBLISHED, services.submit_for_review),
        (NewsStatus.PUBLISHED, services.reject),
        (NewsStatus.REJECTED, services.publish),
        (NewsStatus.ARCHIVED, services.publish),
    ],
)
def test_invalid_transitions_are_conflicts(start: NewsStatus, action: object) -> None:
    news = make_news(make_organization(), status=start, published_at=timezone.now())

    with pytest.raises(ApiError) as exc:
        action(news)  # type: ignore[operator]

    assert exc.value.status_code == 409


def test_database_refuses_published_news_without_a_date() -> None:
    with pytest.raises(IntegrityError), transaction.atomic():
        make_news(make_organization(), status=NewsStatus.PUBLISHED)


def test_same_title_gets_distinct_slugs_in_one_company_but_may_repeat_across_companies() -> None:
    one, two = make_organization(), make_organization()

    first, second = make_news(one, title="Launch"), make_news(one, title="Launch")
    other = make_news(two, title="Launch")

    assert (first.slug, second.slug, other.slug) == ("launch", "launch-2", "launch")


def test_public_api_shows_only_published_past_news_of_active_companies(client: Client) -> None:
    now = timezone.now()
    company = make_organization(name="الف", english_name="alpha", is_verified=True)
    inactive = make_organization(is_active=False)
    make_news(
        company, title="visible", status=NewsStatus.PUBLISHED, published_at=now - timedelta(hours=1)
    )
    make_news(company, title="draft")
    make_news(
        company, title="future", status=NewsStatus.PUBLISHED, published_at=now + timedelta(days=1)
    )
    make_news(inactive, title="hidden company", status=NewsStatus.PUBLISHED, published_at=now)

    body = client.get("/api/v1/news/").json()

    assert [n["title"] for n in body["items"]] == ["visible"]
    assert body["items"][0]["organization"]["slug"] == "alpha"
    assert body["items"][0]["organization"]["is_verified"] is True


def test_filter_by_company_and_detail_by_company_and_slug(client: Client) -> None:
    now = timezone.now()
    alpha = make_organization(english_name="alpha")
    beta = make_organization(english_name="beta")
    make_news(alpha, title="Hello World", status=NewsStatus.PUBLISHED, published_at=now)
    make_news(beta, title="Other", status=NewsStatus.PUBLISHED, published_at=now)

    listed = client.get("/api/v1/news/?organization=alpha").json()["items"]
    detail = client.get("/api/v1/news/alpha/hello-world/")

    assert [n["title"] for n in listed] == ["Hello World"]
    assert detail.status_code == 200
    assert detail.json()["content"] == "Body text."
    assert client.get("/api/v1/news/beta/hello-world/").status_code == 404
