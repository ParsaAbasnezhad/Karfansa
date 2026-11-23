"""Unified collaboration authorization and workflow tests."""

import subprocess
import sys
from decimal import Decimal
from pathlib import Path
from uuid import uuid4

import pytest
from django.core.cache import cache
from django.db import IntegrityError, transaction
from django.test import Client

from apps.accounts.models import User
from apps.organizations.models import MemberRole, MembershipStatus, OrganizationMember
from apps.services.inquiries_api import _safe_url
from apps.services.models import (
    InquiryMessage,
    InquiryNotification,
    InquiryStatusEvent,
    ProductInquiry,
    ProductListing,
    SellerProfile,
    ServiceCategory,
)
from apps.trade.models import TradeOpportunity
from tests.factories import make_organization, province

pytestmark = pytest.mark.django_db
URL = "/api/v1/inquiries"


def user(n: int) -> User:
    return User.objects.create_user(
        email=f"inquiry-{n}@example.com",
        phone=f"0912777{n:04}",
        password="test-password-123",
        first_name="کاربر",
        last_name=str(n),
    )


def listing(owner: User, kind: str = "product", organization=None) -> ProductListing:
    seller = (
        None
        if organization
        else SellerProfile.objects.create(
            user=owner,
            display_name=f"فروشنده {owner.pk}",
            is_public=True,
            public_phone="09127778888",
            public_email="public@example.com",
        )
    )
    category, _ = ServiceCategory.objects.get_or_create(
        slug="inquiry-test",
        defaults={"name": "آزمون"},
    )
    item = ProductListing.objects.create(
        seller=seller,
        organization=organization,
        category=category,
        province=province("tehran"),
        listing_kind=kind,
        title=f"آگهی {kind} {owner.pk}",
        description="شرح آگهی آزمون همکاری",
        quantity=Decimal("10"),
        unit="عدد",
    )
    item.transition_to(ProductListing.Status.PENDING_REVIEW)
    item.transition_to(ProductListing.Status.APPROVED)
    return item


def opportunity(owner: User, company=None) -> TradeOpportunity:
    return TradeOpportunity.objects.create(
        title=f"فرصت آزمون {owner.pk}",
        province=province("tehran"),
        opportunity_type="partnership",
        description="شرح فرصت همکاری",
        company=company,
        created_by=owner,
        review_status="approved",
        is_published=True,
    )


def create(client: Client, kind: str, slug: str, key=None):
    return client.post(
        f"{URL}/",
        data={
            "target_type": kind,
            "target_slug": slug,
            "category": "partnership",
            "subject": "موضوع همکاری آزمایشی",
            "message": "شرح کامل درخواست همکاری آزمایشی",
            "client_key": str(key or uuid4()),
        },
        content_type="application/json",
    )


@pytest.mark.parametrize("kind", ["product", "service", "trade"])
def test_create_track_and_idempotency(client: Client, kind: str) -> None:
    cache.clear()
    owner, applicant = user(1), user(2)
    target = opportunity(owner) if kind == "trade" else listing(owner, kind)
    client.force_login(applicant)
    key = uuid4()
    response = create(client, kind, target.slug, key)
    assert response.status_code == 201, response.content
    public_id = response.json()["public_id"]
    assert create(client, kind, target.slug, key).status_code == 200
    assert ProductInquiry.objects.count() == 1
    assert client.get(f"{URL}/submitted").json()["count"] == 1
    assert client.get(f"{URL}/{public_id}").status_code == 200
    client.force_login(owner)
    received = client.get(f"{URL}/received").json()
    assert received["count"] == 1 and received["results"][0]["unread"]
    assert client.get(f"{URL}/notifications/list").json()["unread_count"] == 1
    client.get(f"{URL}/{public_id}")
    assert not client.get(f"{URL}/received").json()["results"][0]["unread"]
    assert client.get(f"{URL}/notifications/list").json()["unread_count"] == 0


def test_owner_status_messages_notifications_and_applicant_followup(client: Client) -> None:
    cache.clear()
    owner, applicant, outsider = user(3), user(4), user(5)
    item = listing(owner)
    assert create(client, "product", item.slug).status_code == 401
    client.force_login(applicant)
    public_id = create(client, "product", item.slug).json()["public_id"]
    status_url = f"{URL}/{public_id}/status"
    message_url = f"{URL}/{public_id}/messages"
    assert (
        client.patch(
            status_url, data={"status": "accepted"}, content_type="application/json"
        ).status_code
        == 403
    )
    client.force_login(outsider)
    assert client.get(f"{URL}/{public_id}").status_code == 404
    assert (
        client.post(
            message_url, data={"body": "پیام مهاجم"}, content_type="application/json"
        ).status_code
        == 404
    )
    client.force_login(owner)
    changed = client.patch(
        status_url, data={"status": "reviewing"}, content_type="application/json"
    )
    assert changed.status_code == 200, changed.content
    assert (
        client.patch(
            status_url, data={"status": "new"}, content_type="application/json"
        ).status_code
        == 400
    )
    assert (
        client.post(
            message_url, data={"body": "پاسخ مالک"}, content_type="application/json"
        ).status_code
        == 201
    )
    assert InquiryStatusEvent.objects.count() == 1
    client.force_login(applicant)
    assert client.get(f"{URL}/notifications/list").json()["unread_count"] == 2
    detail = client.get(f"{URL}/{public_id}").json()
    assert detail["messages"][0]["body"] == "پاسخ مالک"
    assert client.get(f"{URL}/notifications/list").json()["unread_count"] == 0
    assert (
        client.post(
            message_url, data={"body": "پیام پیگیری"}, content_type="application/json"
        ).status_code
        == 201
    )
    assert InquiryMessage.objects.count() == 2
    client.force_login(owner)
    assert client.get(f"{URL}/notifications/list").json()["unread_count"] == 1
    assert (
        client.patch(
            status_url, data={"status": "rejected"}, content_type="application/json"
        ).status_code
        == 200
    )
    client.force_login(applicant)
    assert (
        client.post(
            message_url, data={"body": "پیام پس از رد"}, content_type="application/json"
        ).status_code
        == 400
    )


@pytest.mark.parametrize("kind", ["product", "service"])
def test_company_active_identity_and_member_revocation(client: Client, kind: str) -> None:
    cache.clear()
    owner, member, applicant = user(6), user(7), user(8)
    company = make_organization()
    OrganizationMember.objects.create(
        organization=company,
        user=owner,
        role=MemberRole.OWNER,
        status=MembershipStatus.ACTIVE,
    )
    membership = OrganizationMember.objects.create(
        organization=company,
        user=member,
        role=MemberRole.MEMBER,
        status=MembershipStatus.ACTIVE,
    )
    item = listing(owner, kind, organization=company)
    client.force_login(applicant)
    public_id = create(client, kind, item.slug).json()["public_id"]
    client.force_login(member)
    assert client.get(f"{URL}/received").json()["count"] == 0
    session = client.session
    session["karfansa_business_identity"] = {"kind": "organization", "id": str(company.pk)}
    session.save()
    assert client.get(f"{URL}/received").json()["count"] == 1
    assert client.get(f"{URL}/{public_id}").status_code == 200
    membership.status = MembershipStatus.REMOVED
    membership.save()
    assert client.get(f"{URL}/received").status_code == 403
    assert client.get(f"{URL}/{public_id}").status_code in {403, 404}


def test_self_requests_contact_validation_and_pagination(client: Client) -> None:
    cache.clear()
    owner, applicant = user(9), user(10)
    item = listing(owner)
    client.force_login(owner)
    assert create(client, "product", item.slug).status_code == 403
    contact = client.get(f"{URL}/contact/product/{item.slug}").json()
    assert {channel["label"] for channel in contact["channels"]} == {"تلفن", "ایمیل"}
    item.seller.public_email = "invalid"
    item.seller.save()
    client.force_login(applicant)
    contact = client.get(f"{URL}/contact/product/{item.slug}").json()
    assert {channel["label"] for channel in contact["channels"]} == {"تلفن"}
    assert create(client, "product", item.slug).status_code == 201
    assert create(client, "product", item.slug).status_code == 429
    result = client.get(f"{URL}/submitted", {"page": 1, "page_size": 1}).json()
    assert result["count"] == 1 and len(result["results"]) == 1
    assert client.get(f"{URL}/submitted", {"page_size": 51}).status_code == 400
    inquiry = ProductInquiry.objects.get()
    with pytest.raises(IntegrityError), transaction.atomic():
        ProductInquiry.objects.filter(pk=inquiry.pk).update(trade_opportunity=opportunity(owner))
    assert InquiryNotification.objects.count() == 1


def test_owner_accepts_and_applicant_can_follow_up(client: Client) -> None:
    cache.clear()
    owner, applicant = user(22), user(23)
    item = listing(owner, "service")
    client.force_login(applicant)
    public_id = create(client, "service", item.slug).json()["public_id"]
    client.force_login(owner)
    accepted = client.patch(
        f"{URL}/{public_id}/status",
        data={"status": "accepted"},
        content_type="application/json",
    )
    assert accepted.status_code == 200
    assert accepted.json()["status"] == "accepted"
    client.force_login(applicant)
    assert (
        client.post(
            f"{URL}/{public_id}/messages",
            data={"body": "پیگیری توافق"},
            content_type="application/json",
        ).status_code
        == 201
    )


def test_received_pagination_and_filters(client: Client) -> None:
    cache.clear()
    owner, first, second = user(24), user(25), user(26)
    item = listing(owner)
    for applicant in (first, second):
        client.force_login(applicant)
        assert create(client, "product", item.slug).status_code == 201
    client.force_login(owner)
    first_page = client.get(f"{URL}/received", {"page_size": 1}).json()
    next_page = client.get(f"{URL}/received", {"page_size": 1, "page": 2}).json()
    assert first_page["count"] == 2 and first_page["total_pages"] == 2
    assert first_page["results"][0]["public_id"] != next_page["results"][0]["public_id"]
    assert client.get(f"{URL}/received", {"target_type": "trade"}).json()["count"] == 0
    assert client.get(f"{URL}/received", {"status": "new"}).json()["count"] == 2


@pytest.mark.parametrize(
    "value,host",
    [
        ("javascript:alert(1)", None),
        ("http://example.com", None),
        ("https://user:pass@example.com", None),
        ("https://evil.example/user", "t.me"),
        ("https://instagram.com/p/post", "instagram.com"),
        ("https://t.me/bot\n", "t.me"),
    ],
)
def test_unsafe_contact_urls_are_rejected(value: str, host: str | None) -> None:
    assert _safe_url(value, host) is None


def test_company_trade_scope_and_public_contact_safety(client: Client) -> None:
    cache.clear()
    owner, second_owner, applicant = user(11), user(12), user(13)
    first = make_organization(
        is_verified=True,
        phone="021-12345678",
        email="hello@example.com",
        telegram="javascript:alert(1)",
        instagram="https://evil.example/profile",
        website="https://example.com",
    )
    second = make_organization()
    for org, account in ((first, owner), (second, second_owner)):
        OrganizationMember.objects.create(
            organization=org,
            user=account,
            role=MemberRole.OWNER,
            status=MembershipStatus.ACTIVE,
        )
    trade = opportunity(owner, first)
    client.force_login(applicant)
    public_id = create(client, "trade", trade.slug).json()["public_id"]
    contact = client.get(f"{URL}/contact/trade/{trade.slug}").json()
    assert {part["label"] for part in contact["channels"]} == {
        "تلفن",
        "ایمیل",
        "وب‌سایت",
    }
    client.force_login(owner)
    session = client.session
    session["karfansa_business_identity"] = {"kind": "organization", "id": str(first.pk)}
    session.save()
    assert client.get(f"{URL}/received").json()["count"] == 1
    assert create(client, "trade", trade.slug).status_code == 403
    client.force_login(second_owner)
    session = client.session
    session["karfansa_business_identity"] = {"kind": "organization", "id": str(second.pk)}
    session.save()
    assert client.get(f"{URL}/received").json()["count"] == 0
    assert client.get(f"{URL}/{public_id}").status_code == 404


def test_unpublished_listing_keeps_private_inquiry_history(client: Client) -> None:
    cache.clear()
    owner, applicant = user(14), user(15)
    item = listing(owner, "service")
    client.force_login(applicant)
    public_id = create(client, "service", item.slug).json()["public_id"]
    item.transition_to(ProductListing.Status.ARCHIVED)
    assert client.get(f"{URL}/contact/service/{item.slug}").status_code == 404
    assert client.get(f"{URL}/{public_id}").status_code == 200
    client.force_login(owner)
    assert client.get(f"{URL}/{public_id}").status_code == 200


def test_csrf_is_required_for_inquiry_writes() -> None:
    owner, applicant = user(16), user(17)
    item = listing(owner)
    strict = Client(enforce_csrf_checks=True)
    strict.force_login(applicant)
    assert create(strict, "product", item.slug).status_code == 403


def test_migration_backfills_unique_ids_and_owner_for_existing_inquiries() -> None:
    script = Path(__file__).resolve().parents[2] / "scripts" / "verify_inquiry_migration.py"
    result = subprocess.run(  # noqa: S603
        [sys.executable, str(script)],
        capture_output=True,
        text=True,
        check=False,
        timeout=120,
    )
    assert result.returncode == 0, result.stdout + result.stderr
