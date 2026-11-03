import pytest
from django.db import IntegrityError, transaction
from django.test import Client

from apps.geography.models import Country, Province

pytestmark = pytest.mark.django_db


def test_iran_and_its_31_provinces_are_seeded() -> None:
    assert Country.objects.filter(iso2="IR", name_fa="ایران").exists()
    assert Province.objects.filter(country__iso2="IR").count() == 31


def test_seed_uses_persian_letters_not_arabic_variants() -> None:
    names = " ".join(Province.objects.values_list("name_fa", flat=True))

    assert "\u064a" not in names  # Arabic yeh
    assert "\u0643" not in names  # Arabic kaf


def test_province_slug_is_unique() -> None:
    iran = Country.objects.get(iso2="IR")

    with pytest.raises(IntegrityError), transaction.atomic():
        Province.objects.create(country=iran, name_fa="دیگر", name_en="Other", slug="tehran")


def test_provinces_endpoint_lists_and_filters_by_country(client: Client) -> None:
    response = client.get("/api/v1/geography/provinces/?country=ir")

    assert response.status_code == 200
    assert len(response.json()) == 31
    assert client.get("/api/v1/geography/provinces/?country=ZZ").json() == []


def test_countries_endpoint(client: Client) -> None:
    body = client.get("/api/v1/geography/countries/").json()

    assert [c["iso2"] for c in body] == ["IR"]
