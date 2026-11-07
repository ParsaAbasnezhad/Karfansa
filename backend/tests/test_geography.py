import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.test import Client

from apps.geography.models import Country, Province, ProvinceCity, ProvinceIndustry
from apps.organizations.models import Industry, IndustryCategory, Organization, Product


@pytest.mark.django_db
def test_iran_provinces_have_published_profiles_and_capitals() -> None:
    iran = Country.objects.get(iso2="IR")
    provinces = list(Province.objects.filter(country=iran).select_related("capital"))

    assert len(provinces) == 31
    assert all(province.is_published for province in provinces)
    assert all(province.capital is not None for province in provinces)
    assert all(province.capital.province_id == province.pk for province in provinces)
    assert all(
        province.population is None and province.area_sq_km is None for province in provinces
    )


@pytest.mark.django_db
def test_province_detail_exposes_city_directory_and_optional_statistics() -> None:
    province = Province.objects.get(slug="tehran")

    response = Client().get(f"/api/v1/geography/provinces/{province.slug}/")

    assert response.status_code == 200
    payload = response.json()
    assert payload["name_fa"] == "تهران"
    assert payload["capital"]["name_fa"] == "تهران"
    assert payload["population"] is None
    assert payload["area_sq_km"] is None
    assert payload["cities"]
    assert all(city["province_id"] == province.pk for city in payload["cities"])


@pytest.mark.django_db
def test_unpublished_province_profile_is_not_public() -> None:
    province = Province.objects.get(slug="tehran")
    province.is_published = False
    province.save(update_fields=["is_published"])

    response = Client().get(f"/api/v1/geography/provinces/{province.slug}/")

    assert response.status_code == 404


@pytest.mark.django_db
def test_province_city_slugs_are_unique_within_their_province() -> None:
    city = ProvinceCity.objects.filter(province__slug="tehran").first()
    assert city is not None

    with pytest.raises(IntegrityError):
        ProvinceCity.objects.create(
            province=city.province,
            name_fa="شهر تکراری",
            slug=city.slug,
        )


@pytest.mark.django_db
def test_published_province_industries_include_products_active_companies_and_sources() -> None:
    province = Province.objects.get(slug="tehran")
    city = ProvinceCity.objects.filter(province=province).first()
    assert city is not None
    industry = Industry.objects.create(
        name_fa="صنعت نمونه",
        slug="sample-industry",
        category=IndustryCategory.ENERGY,
        is_published=True,
    )
    product = Product.objects.create(name_fa="محصول نمونه", slug="sample-product")
    industry.products.add(product)
    Industry.objects.create(
        name_fa="صنعت پیش‌نویس",
        slug="draft-industry",
        category=IndustryCategory.ENERGY,
        is_published=False,
    )
    record = ProvinceIndustry.objects.create(
        province=province,
        industry=industry,
        activity_level=ProvinceIndustry.ActivityLevel.HIGH,
        production_capacity="12.5",
        production_capacity_unit="تن در سال",
        source="گزارش معتبر",
        source_url="https://example.com/report",
        updated_year=1404,
    )
    record.active_cities.add(city)
    Organization.objects.create(
        name="شرکت نمونه",
        slug="sample-company",
        province=province,
        industry=industry,
        is_active=True,
    )
    Organization.objects.create(
        name="شرکت غیرفعال",
        slug="inactive-company",
        province=province,
        industry=industry,
        is_active=False,
    )

    response = Client().get(
        "/api/v1/geography/industries/?province=tehran&category=energy"
    )

    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 1
    assert payload[0]["production_capacity"] == "12.5000"
    assert payload[0]["active_cities"][0]["id"] == city.pk
    assert [item["name_fa"] for item in payload[0]["products"]] == ["محصول نمونه"]
    assert [item["slug"] for item in payload[0]["companies"]] == ["sample-company"]
    assert payload[0]["source_url"] == "https://example.com/report"

    detail = Client().get(f"/api/v1/geography/provinces/{province.slug}/").json()
    assert len(detail["industries"]) == 1
    assert detail["industries"][0]["industry_slug"] == industry.slug


@pytest.mark.django_db
def test_published_industries_require_a_category() -> None:
    industry = Industry(
        name_fa="صنعت بدون دسته",
        slug="uncategorized-industry",
        is_published=True,
    )

    with pytest.raises(ValidationError) as exc_info:
        industry.full_clean()
    assert "category" in exc_info.value.message_dict


@pytest.mark.django_db
def test_production_capacity_requires_a_unit_source_and_update_year() -> None:
    province = Province.objects.get(slug="tehran")
    industry = Industry.objects.create(
        name_fa="صنعت ظرفیت‌دار",
        slug="capacity-industry",
        category=IndustryCategory.ENERGY,
        is_published=True,
    )

    record = ProvinceIndustry(
        province=province,
        industry=industry,
        production_capacity="12.5",
        production_capacity_unit="تن در سال",
        updated_year=1404,
    )

    with pytest.raises(ValidationError, match="منبع معتبر"):
        record.full_clean()
    with pytest.raises(IntegrityError):
        ProvinceIndustry.objects.create(
            province=province,
            industry=industry,
            production_capacity="12.5",
            production_capacity_unit="تن در سال",
            updated_year=1404,
        )
