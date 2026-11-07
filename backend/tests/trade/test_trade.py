from datetime import timedelta

import pytest
from django.core.exceptions import ValidationError
from django.test import Client
from django.utils import timezone

from apps.accounts.models import User
from apps.organizations.models import Industry, Product
from apps.trade.models import OpportunityReviewStatus, TradeOpportunity
from tests.factories import make_industry, make_organization, province

pytestmark = pytest.mark.django_db


def make_opportunity(**fields: object) -> TradeOpportunity:
    opportunity_fields: dict[str, object] = {
        "title": "فرصت صادراتی",
        "province": province("tehran"),
        "opportunity_type": "export",
        "description": "اطلاعات فرصت تجاری برای آزمون",
        "source": "گزارش معتبر",
        "review_status": OpportunityReviewStatus.APPROVED,
        "is_published": True,
        "published_at": timezone.now(),
    }
    opportunity_fields.update(fields)
    return TradeOpportunity.objects.create(**opportunity_fields)


def test_public_opportunities_only_returns_approved_active_matches(client: Client) -> None:
    active = make_opportunity(target_market="ترکیه", relevance_score=80)
    make_opportunity(
        title="فرصت در انتظار",
        review_status=OpportunityReviewStatus.PENDING,
        is_published=False,
        published_at=None,
    )
    make_opportunity(
        title="فرصت منقضی",
        valid_until=timezone.localdate() - timedelta(days=1),
    )

    response = client.get("/api/v1/trade/opportunities/?q=ترکیه&ordering=relevance")

    assert response.status_code == 200
    body = response.json()
    assert body["count"] == 1
    assert body["results"][0]["id"] == active.pk
    assert body["results"][0]["relevance_score"] == 80


def test_submission_is_private_pending_and_restricted_to_company_members(client: Client) -> None:
    user = User.objects.create_user(
        email="member@example.com",
        password="test-pass",
        phone="09120000001",
    )
    organization = make_organization()
    organization.members.add(user)
    payload = {
        "title": "تأمین خرما",
        "province_id": province("tehran").pk,
        "opportunity_type": "export",
        "description": "نیاز به تأمین خرمای صادراتی با کیفیت",
        "source": "ثبت شرکت",
        "company_id": str(organization.pk),
    }

    unauthenticated = client.post(
        "/api/v1/trade/opportunities/",
        payload,
        content_type="application/json",
    )
    assert unauthenticated.status_code == 401
    client.force_login(user)
    response = client.post(
        "/api/v1/trade/opportunities/",
        payload,
        content_type="application/json",
    )

    assert response.status_code == 201
    created = TradeOpportunity.objects.get(pk=response.json()["id"])
    assert created.created_by == user
    assert created.review_status == OpportunityReviewStatus.PENDING
    assert not created.is_published
    assert created.company == organization
    assert client.get("/api/v1/trade/opportunities/").json()["count"] == 0

    payload["company_id"] = str(make_organization().pk)
    rejected = client.post(
        "/api/v1/trade/opportunities/",
        payload,
        content_type="application/json",
    )
    assert rejected.status_code == 403


def test_options_include_product_industry_relationships(client: Client) -> None:
    industry = make_industry(
        name_fa="صنایع غذایی",
        slug="food-industry",
        category="food",
        is_published=True,
    )
    product = Product.objects.create(name_fa="خرما", slug="dates")
    industry.products.add(product)

    response = client.get("/api/v1/trade/options/")

    assert response.status_code == 200
    product_option = next(item for item in response.json()["products"] if item["id"] == product.pk)
    assert product_option["industry_slugs"] == ["food-industry"]


def test_related_product_must_belong_to_selected_industry() -> None:
    product = Product.objects.create(name_fa="محصول", slug="product")
    industry = Industry.objects.create(
        name_fa="صنعت", slug="industry", category="food", is_published=True
    )
    opportunity = TradeOpportunity(
        title="فرصت",
        province=province("tehran"),
        product=product,
        industry=industry,
        opportunity_type="export",
        description="شرح فرصت",
        source="منبع",
    )

    with pytest.raises(ValidationError) as error:
        opportunity.full_clean()
    assert "product" in error.value.message_dict
