from datetime import timedelta

import pytest
from django.db import IntegrityError, transaction
from django.test import Client
from django.utils import timezone

from apps.advertising import services
from apps.advertising.models import AdvertisementStatus
from apps.core.errors import ApiError
from tests.factories import make_advertisement, make_organization

pytestmark = pytest.mark.django_db


def test_approve_publishes_and_stamps_the_date() -> None:
    ad = make_advertisement(make_organization(), status=AdvertisementStatus.PENDING)

    services.approve(ad)
    ad.refresh_from_db()

    assert ad.status == AdvertisementStatus.PUBLISHED
    assert ad.published_at is not None


def test_reject_requires_a_reason_and_stores_it() -> None:
    ad = make_advertisement(make_organization(), status=AdvertisementStatus.PENDING)

    with pytest.raises(ApiError) as exc:
        services.reject(ad, reason="   ")
    assert exc.value.code == "rejection_reason_required"

    services.reject(ad, reason="تصویر نامناسب")
    ad.refresh_from_db()
    assert (ad.status, ad.rejection_reason) == (AdvertisementStatus.REJECTED, "تصویر نامناسب")


def test_resubmitting_a_rejected_ad_clears_the_reason() -> None:
    ad = make_advertisement(make_organization(), status=AdvertisementStatus.PENDING)
    services.reject(ad, reason="x")
    services.return_to_draft(ad)

    services.submit_for_review(ad)

    assert ad.status == AdvertisementStatus.PENDING
    assert ad.rejection_reason == ""


def test_published_ad_cannot_be_rejected() -> None:
    ad = make_advertisement(
        make_organization(), status=AdvertisementStatus.PUBLISHED, published_at=timezone.now()
    )

    with pytest.raises(ApiError) as exc:
        services.reject(ad, reason="late")

    assert exc.value.status_code == 409


def test_database_constraints_protect_the_rules() -> None:
    company, now = make_organization(), timezone.now()

    with pytest.raises(IntegrityError), transaction.atomic():
        make_advertisement(company, status=AdvertisementStatus.REJECTED)  # no reason
    with pytest.raises(IntegrityError), transaction.atomic():
        make_advertisement(company, status=AdvertisementStatus.PUBLISHED)  # no date
    with pytest.raises(IntegrityError), transaction.atomic():
        make_advertisement(company, start_at=now, end_at=now - timedelta(days=1))


def test_public_api_lists_only_ads_that_are_showing_now(client: Client) -> None:
    now = timezone.now()
    company = make_organization()
    published = {"status": AdvertisementStatus.PUBLISHED, "published_at": now}
    make_advertisement(company, title="open window", **published)
    make_advertisement(
        company,
        title="inside",
        start_at=now - timedelta(days=1),
        end_at=now + timedelta(days=1),
        **published,
    )
    make_advertisement(
        company,
        title="expired",
        start_at=now - timedelta(days=5),
        end_at=now - timedelta(days=1),
        **published,
    )
    make_advertisement(company, title="not started", start_at=now + timedelta(days=1), **published)
    make_advertisement(company, title="draft")
    make_advertisement(make_organization(is_active=False), title="hidden company", **published)

    titles = {a["title"] for a in client.get("/api/v1/advertisements/").json()["items"]}

    assert titles == {"open window", "inside"}
