from django.db.models import Prefetch, QuerySet
from django.shortcuts import get_object_or_404

from apps.organizations.models import Organization

from .models import Country, Province, ProvinceCity, ProvinceIndustry


def list_countries() -> QuerySet[Country]:
    return Country.objects.all()


def list_provinces(*, country_iso2: str | None = None) -> QuerySet[Province]:
    queryset = Province.objects.all()
    if country_iso2:
        queryset = queryset.filter(country__iso2__iexact=country_iso2)
    return queryset


def list_cities(*, province_id: int) -> QuerySet[ProvinceCity]:
    return ProvinceCity.objects.filter(province_id=province_id)


def get_published_province(*, slug: str) -> Province:
    return get_object_or_404(
        Province.objects.select_related("country", "capital").prefetch_related(
            "cities",
            "province_industries__industry__products",
            "province_industries__active_cities",
            Prefetch(
                "province_industries__industry__organizations",
                queryset=Organization.objects.filter(is_active=True).only(
                    "slug", "name", "province_id", "industry_id"
                ),
            ),
        ),
        slug=slug,
        is_published=True,
    )


def list_published_province_industries(
    *, province_slug: str | None = None, category: str | None = None
) -> QuerySet[ProvinceIndustry]:
    queryset = (
        ProvinceIndustry.objects.filter(
            province__is_published=True,
            industry__is_published=True,
            province__country__iso2="IR",
        )
        .select_related("province", "industry")
        .prefetch_related(
            "active_cities",
            "industry__products",
            Prefetch(
                "industry__organizations",
                queryset=Organization.objects.filter(is_active=True).only(
                    "slug", "name", "province_id", "industry_id"
                ),
            ),
        )
    )
    if province_slug:
        queryset = queryset.filter(province__slug=province_slug)
    if category:
        queryset = queryset.filter(industry__category=category)
    return queryset
