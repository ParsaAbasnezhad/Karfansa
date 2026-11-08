from datetime import timedelta
from decimal import Decimal
from urllib.parse import urlencode

import pytest
from django.core.exceptions import ValidationError
from django.test import Client
from django.utils import timezone

from apps.accounts.models import User
from apps.geography.models import ProvinceCity
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


def test_smart_search_normalizes_arabic_letters_and_ranks_exact_products(client: Client) -> None:
    wheat = Product.objects.create(name_fa="گندم", name_en="Wheat", slug="wheat")
    exact_product = make_opportunity(
        title="فرصت خرید محصول کشاورزی",
        description="اطلاعات موجود در شرح فرصت",
        product=wheat,
    )
    title_match = make_opportunity(
        title="گندم تجاري",
        description="فرصت کشاورزی با جزئیات",
    )

    response = client.get(
        f"/api/v1/trade/opportunities/search/?{urlencode({'q': 'گندم تجاری'})}"
    )

    assert response.status_code == 200
    results = response.json()["results"]
    assert [item["id"] for item in results] == [exact_product.pk, title_match.pk]
    assert results[0]["match_score"] > results[1]["match_score"]


def test_smart_search_expands_catalog_synonyms(client: Client) -> None:
    dates = Product.objects.create(
        name_fa="خرمای مضافتی",
        slug="mazafati-dates",
    )
    opportunity = make_opportunity(product=dates, title="فروش عمده محصول کشاورزی")

    response = client.get("/api/v1/trade/opportunities/search/?q=dates")

    assert response.status_code == 200
    assert [item["id"] for item in response.json()["results"]] == [opportunity.pk]


def test_natural_language_search_extracts_product_province_type_and_quantity(
    client: Client,
) -> None:
    wheat = Product.objects.create(name_fa="گندم", slug="wheat-natural")
    industry = make_industry(
        name_fa="کشاورزی طبیعی",
        slug="natural-agriculture",
        category="agriculture",
        is_published=True,
    )
    far_product = make_opportunity(
        province=province("fars"),
        product=wheat,
        industry=industry,
        opportunity_type="bulk-buy",
        title="تأمین گندم برای کارخانه",
        description="خریدار به گندم برای تولید مواد غذایی نیاز دارد",
        required_volume=500,
        volume_unit="تن",
    )
    make_opportunity(
        province=province("tehran"),
        title="تأمین قطعات کارخانه",
        description="مقداری قطعه صنعتی لازم است",
    )

    natural_query = (
        "\u06a9\u0627\u0631\u062e\u0627\u0646\u0647\u200c\u0627\u06cc "
        "\u062f\u0631 \u0627\u0633\u062a\u0627\u0646 \u0641\u0627\u0631\u0633 "
        "\u06a9\u0647 \u0628\u0647 \u06af\u0646\u062f\u0645 "
        "\u0646\u06cc\u0627\u0632 \u062f\u0627\u0631\u062f \u06f5\u06f0\u06f0 "
        "\u062a\u0646"
    )
    response = client.get(
        f"/api/v1/trade/opportunities/search/?{urlencode({'q': natural_query})}"
    )

    assert response.status_code == 200
    body = response.json()
    assert [item["id"] for item in body["results"]] == [far_product.pk]
    assert body["interpreted"]["product"] == "گندم"
    assert body["interpreted"]["province"] == "fars"
    assert body["interpreted"]["opportunity_type"] == "bulk-buy"
    assert body["interpreted"]["quantity"] == "500"
    assert body["interpreted"]["quantity_unit"] == "تن"


def test_smart_search_applies_composable_filters_and_pagination(client: Client) -> None:
    province_fars = province("fars")
    city = ProvinceCity.objects.filter(province=province_fars).first()
    assert city is not None
    industry = make_industry(
        name_fa="صنایع غذایی فرصت",
        slug="food-opportunity",
        category="food",
        is_published=True,
    )
    product = Product.objects.create(name_fa="خرما تست", slug="dates-filter-test")
    industry.products.add(product)
    first = make_opportunity(
        province=province_fars,
        city=city,
        industry=industry,
        product=product,
        opportunity_type="bulk-buy",
        required_volume=50,
        volume_unit="تن",
    )
    second = make_opportunity(
        province=province_fars,
        city=city,
        industry=industry,
        product=product,
        opportunity_type="bulk-buy",
        required_volume=75,
        volume_unit="تن",
    )
    make_opportunity(
        province=province("tehran"),
        industry=industry,
        product=product,
        opportunity_type="export",
        required_volume=80,
        volume_unit="تن",
    )
    params = {
        "province": "fars",
        "city": str(city.pk),
        "category": "food",
        "opportunity_type": "bulk-buy",
        "product": product.slug,
        "min_quantity": "40",
        "max_quantity": "80",
        "volume_unit": "تن",
        "ordering": "quantity",
        "page_size": "1",
    }

    response = client.get(
        f"/api/v1/trade/opportunities/search/?{urlencode(params)}"
    )
    body = response.json()

    assert response.status_code == 200
    assert body["count"] == 2
    assert body["total_pages"] == 2
    assert body["results"][0]["id"] == second.pk
    assert body["applied_filters"]["category"] == "food"
    next_page = client.get(
        f"/api/v1/trade/opportunities/search/?{urlencode({**params, 'page': '2'})}"
    ).json()
    assert next_page["results"][0]["id"] == first.pk


def test_smart_search_status_dates_and_private_company_contacts(client: Client) -> None:
    organization = make_organization(
        name="شرکت تأییدشدهٔ جست‌وجو",
        is_verified=True,
        email="public@example.com",
    )
    verified = make_opportunity(company=organization)
    make_opportunity(
        title="فرصت غیرفعال",
        is_published=False,
        review_status=OpportunityReviewStatus.PENDING,
    )
    make_opportunity(
        title="فرصت منقضی",
        valid_until=timezone.localdate() - timedelta(days=1),
    )
    make_opportunity(
        title="فرصت بدون تماس",
        company=make_organization(name="شرکت بدون تماس"),
    )
    contact_query = urlencode(
        {"has_contact": "true", "date_from": timezone.localdate().isoformat()}
    )

    response = client.get(f"/api/v1/trade/opportunities/search/?{contact_query}")
    body = response.json()

    assert response.status_code == 200
    assert body["count"] == 1
    result = body["results"][0]
    assert result["id"] == verified.pk
    assert result["has_verified_contact"] is True
    assert result["company"]["name"] == organization.name
    assert "email" not in result["company"]
    assert "phone" not in result["company"]
    assert Decimal(result["match_score"]) >= 0


def test_smart_search_expiring_status_and_input_validation(client: Client) -> None:
    expiring = make_opportunity(
        valid_until=timezone.localdate() + timedelta(days=3),
    )
    make_opportunity(valid_until=timezone.localdate() + timedelta(days=60))

    response = client.get("/api/v1/trade/opportunities/search/?status=expiring")
    invalid_range = client.get(
        "/api/v1/trade/opportunities/search/?min_quantity=10&max_quantity=2"
    )

    assert response.status_code == 200
    assert [item["id"] for item in response.json()["results"]] == [expiring.pk]
    assert invalid_range.status_code == 422
