import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.test import Client

from apps.organizations.models import Organization, OrganizationType
from tests.factories import make_industry, make_organization, province

pytestmark = pytest.mark.django_db


def test_slug_comes_from_english_name_then_falls_back() -> None:
    english = make_organization(name="شرکت زعفران", english_name="Saffron Co")
    persian_only = make_organization(name="فقط فارسی")

    assert english.slug == "saffron-co"
    assert persian_only.slug.startswith("company-")


def test_duplicate_slug_gets_a_number() -> None:
    first = make_organization(name="الف", english_name="Same Name")
    second = make_organization(name="ب", english_name="Same Name")

    assert (first.slug, second.slug) == ("same-name", "same-name-2")


def test_national_id_is_unique_only_when_filled() -> None:
    make_organization(national_id="")
    make_organization(national_id="")
    make_organization(national_id="10101010101")

    with pytest.raises(IntegrityError), transaction.atomic():
        make_organization(national_id="10101010101")


def test_digit_validators_reject_letters() -> None:
    organization = Organization(name="X", national_id="12ab", postal_code="12345xyz")

    with pytest.raises(ValidationError) as exc:
        organization.full_clean()

    assert {"national_id", "postal_code"} <= set(exc.value.message_dict)


def test_list_hides_inactive_and_supports_filters(client: Client) -> None:
    steel = make_industry(slug="steel")
    make_organization(
        name="فولاد خراسان",
        english_name="Khorasan Steel",
        industry=steel,
        province=province("razavi-khorasan"),
        organization_type=OrganizationType.MANUFACTURER,
        is_verified=True,
    )
    make_organization(name="بازرگانی تهران", province=province("tehran"))
    make_organization(name="غیرفعال", is_active=False)

    def names(query: str) -> list[str]:
        response = client.get(f"/api/v1/organizations/{query}")
        assert response.status_code == 200
        return [item["name"] for item in response.json()["items"]]

    assert sorted(names("")) == ["بازرگانی تهران", "فولاد خراسان"]
    assert names("?search=فولاد") == ["فولاد خراسان"]
    assert names("?search=khorasan") == ["فولاد خراسان"]
    assert names("?province=tehran") == ["بازرگانی تهران"]
    assert names("?industry=steel") == ["فولاد خراسان"]
    assert names("?organization_type=manufacturer") == ["فولاد خراسان"]
    assert names("?is_verified=true") == ["فولاد خراسان"]


def test_list_is_paginated_with_a_bounded_page_size(client: Client) -> None:
    for _ in range(25):
        make_organization()

    body = client.get("/api/v1/organizations/").json()

    assert body["count"] == 25
    assert len(body["items"]) == 20
    assert client.get("/api/v1/organizations/?limit=1000").status_code in (200, 422)
    assert len(client.get("/api/v1/organizations/?limit=1000").json().get("items", [])) <= 100


def test_invalid_filter_value_is_a_validation_error(client: Client) -> None:
    response = client.get("/api/v1/organizations/?organization_type=nonsense")

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_detail_returns_contacts_and_404s_for_hidden_or_unknown(client: Client) -> None:
    make_organization(name="الف", english_name="Alpha", phone="021-1234567", is_verified=True)
    make_organization(name="ب", english_name="Hidden", is_active=False)

    ok = client.get("/api/v1/organizations/alpha/")
    assert ok.status_code == 200
    assert ok.json()["phone"] == "021-1234567"
    assert ok.json()["is_verified"] is True

    for slug in ("hidden", "unknown"):
        response = client.get(f"/api/v1/organizations/{slug}/")
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "not_found"


def test_industries_route_is_not_mistaken_for_a_company_slug(client: Client) -> None:
    make_industry(slug="steel", name_fa="فولاد")

    response = client.get("/api/v1/organizations/industries/")

    assert response.status_code == 200
    assert [i["slug"] for i in response.json()] == ["steel"]
