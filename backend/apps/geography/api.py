from django.db.models import QuerySet
from django.http import HttpRequest
from ninja import Query, Router
from ninja.errors import HttpError

from . import selectors
from .models import (
    Country,
    Province,
    ProvinceCity,
    ProvinceIndustry,
    ProvinceStatistics,
)
from .schemas import (
    CityOut,
    CountryOut,
    ProvinceDetailOut,
    ProvinceIndustryOut,
    ProvinceOut,
    ProvinceStatisticsOut,
    StatisticIndicatorOut,
)

router = Router()


def city_data(city: ProvinceCity) -> dict[str, object]:
    return {
        "id": city.pk,
        "province_id": city.province_id,
        "slug": city.slug,
        "name_fa": city.name_fa,
        "name_en": city.name_en,
        "population": city.population,
        "description": city.description,
        "is_county_center": city.is_county_center,
        "latitude": city.latitude,
        "longitude": city.longitude,
    }


def province_industry_data(item: ProvinceIndustry) -> dict[str, object]:
    industry = item.industry
    companies = (
        company
        for company in industry.organizations.all()
        if company.province_id == item.province_id
    )
    return {
        "id": item.pk,
        "province_id": item.province_id,
        "province_slug": item.province.slug,
        "province_name_fa": item.province.name_fa,
        "industry_id": industry.pk,
        "industry_slug": industry.slug,
        "industry_name_fa": industry.name_fa,
        "industry_name_en": industry.name_en,
        "category": industry.category,
        "category_display": industry.get_category_display(),
        "industry_description": industry.description,
        "image": industry.image.url if industry.image else None,
        "description": item.description,
        "activity_level": item.activity_level,
        "activity_level_display": item.get_activity_level_display(),
        "production_capacity": item.production_capacity,
        "production_capacity_unit": item.production_capacity_unit,
        "competitive_advantage": item.competitive_advantage,
        "source": item.source,
        "source_url": item.source_url,
        "updated_year": item.updated_year,
        "active_cities": [city_data(city) for city in item.active_cities.all()],
        "products": [
            {
                "id": product.pk,
                "slug": product.slug,
                "name_fa": product.name_fa,
                "name_en": product.name_en,
                "description": product.description,
            }
            for product in industry.products.all()
        ],
        "companies": [{"slug": company.slug, "name": company.name} for company in companies],
    }


def statistics_data(item: ProvinceStatistics) -> dict[str, object]:
    return {
        "id": item.pk,
        "province_slug": item.province.slug,
        "province_name_fa": item.province.name_fa,
        "indicator": item.indicator,
        "indicator_display": item.get_indicator_display(),
        "category": item.category,
        "category_display": item.get_category_display(),
        "value": item.value,
        "value_text": item.value_text,
        "item_label": item.item_label,
        "unit": item.unit,
        "statistical_year": item.statistical_year,
        "period": item.period,
        "period_display": item.get_period_display(),
        "period_number": item.period_number,
        "source": item.source,
        "source_url": item.source_url,
        "source_published_at": item.source_published_at,
        "collected_at": item.collected_at,
        "notes": item.notes,
    }


@router.get("/countries/", response=list[CountryOut], operation_id="geography_countries")
def countries(request: HttpRequest) -> QuerySet[Country]:
    return selectors.list_countries()


@router.get("/provinces/", response=list[ProvinceOut], operation_id="geography_provinces")
def provinces(request: HttpRequest, country: str | None = None) -> QuerySet[Province]:
    """Provinces, optionally filtered by country ISO code (for example ``?country=IR``)."""
    return selectors.list_provinces(country_iso2=country)


@router.get(
    "/industries/",
    response=list[ProvinceIndustryOut],
    operation_id="geography_province_industries",
)
def province_industries(
    request: HttpRequest,
    province: str | None = None,
    category: str | None = None,
) -> list[dict[str, object]]:
    items = selectors.list_published_province_industries(
        province_slug=province, category=category
    )
    return [province_industry_data(item) for item in items]


@router.get(
    "/statistics/indicators/",
    response=list[StatisticIndicatorOut],
    operation_id="geography_statistics_indicators",
)
def statistics_indicators(request: HttpRequest) -> list[dict[str, str]]:
    return [
        {
            "value": value,
            "label": label,
            "category": ProvinceStatistics.INDICATOR_CATEGORIES[value],
            "category_display": ProvinceStatistics.Category(
                ProvinceStatistics.INDICATOR_CATEGORIES[value]
            ).label,
        }
        for value, label in ProvinceStatistics.Indicator.choices
    ]


@router.get(
    "/statistics/",
    response=list[ProvinceStatisticsOut],
    operation_id="geography_statistics_list",
)
def statistics(
    request: HttpRequest,
    province: str | None = None,
    year: int | None = Query(None, ge=1),
    indicator: str | None = None,
    category: str | None = None,
    period: str | None = None,
    period_number: int | None = Query(None, ge=1, le=12),
) -> list[dict[str, object]]:
    filters = {
        "indicator": {value for value, _ in ProvinceStatistics.Indicator.choices},
        "category": {value for value, _ in ProvinceStatistics.Category.choices},
        "period": {value for value, _ in ProvinceStatistics.Period.choices},
    }
    for field, selected in (
        ("indicator", indicator),
        ("category", category),
        ("period", period),
    ):
        if selected and selected not in filters[field]:
            raise HttpError(422, f"Invalid {field} filter")
    items = selectors.list_public_statistics(
        province_slug=province,
        year=year,
        indicator=indicator,
        category=category,
        period=period,
        period_number=period_number,
    )
    return [statistics_data(item) for item in items]


@router.get(
    "/provinces/{slug}/",
    response=ProvinceDetailOut,
    operation_id="geography_province_detail",
)
def province_detail(request: HttpRequest, slug: str) -> dict[str, object]:
    province = selectors.get_published_province(slug=slug)
    capital = province.capital

    return {
        "id": province.pk,
        "slug": province.slug,
        "name_fa": province.name_fa,
        "name_en": province.name_en,
        "is_published": province.is_published,
        "short_description": province.short_description,
        "description": province.description,
        "economic_description": province.economic_description,
        "area_sq_km": province.area_sq_km,
        "population": province.population,
        "latitude": province.latitude,
        "longitude": province.longitude,
        "featured_image": province.featured_image.url if province.featured_image else None,
        "map_image": province.map_image.url if province.map_image else None,
        "created_at": province.created_at,
        "updated_at": province.updated_at,
        "capital": city_data(capital) if capital else None,
        "cities": [city_data(city) for city in province.cities.all()],
        "industries": [
            province_industry_data(item)
            for item in province.province_industries.all()
            if item.industry.is_published
        ],
        "statistics": [statistics_data(item) for item in province.statistics.all()],
    }


@router.get("/cities/", response=list[CityOut], operation_id="geography_cities")
def cities(
    request: HttpRequest,
    province_id: int = Query(..., ge=1),
) -> QuerySet[ProvinceCity]:
    """Cities belonging to the selected province."""
    return selectors.list_cities(province_id=province_id)
