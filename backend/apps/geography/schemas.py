from datetime import date, datetime
from decimal import Decimal

from ninja import Schema


class CountryOut(Schema):
    id: int
    name_fa: str
    name_en: str
    iso2: str


class ProvinceOut(Schema):
    id: int
    slug: str
    name_fa: str
    name_en: str
    is_published: bool


class ProvinceRef(Schema):
    """Compact province reference embedded in other apps' responses."""

    slug: str
    name_fa: str


class CityRef(Schema):
    id: int
    name_fa: str


class CityOut(CityRef):
    province_id: int
    slug: str
    name_en: str
    population: int | None
    description: str
    is_county_center: bool
    latitude: Decimal | None
    longitude: Decimal | None


class IndustryProductOut(Schema):
    id: int
    slug: str
    name_fa: str
    name_en: str
    description: str


class IndustryCompanyOut(Schema):
    slug: str
    name: str


class ProvinceIndustryOut(Schema):
    id: int
    province_id: int
    province_slug: str
    province_name_fa: str
    industry_id: int
    industry_slug: str
    industry_name_fa: str
    industry_name_en: str
    category: str
    category_display: str
    industry_description: str
    image: str | None
    description: str
    activity_level: str
    activity_level_display: str
    production_capacity: Decimal | None
    production_capacity_unit: str
    competitive_advantage: str
    source: str
    source_url: str
    updated_year: int | None
    active_cities: list[CityOut]
    products: list[IndustryProductOut]
    companies: list[IndustryCompanyOut]


class ProvinceStatisticsOut(Schema):
    id: int
    province_slug: str
    province_name_fa: str
    indicator: str
    indicator_display: str
    category: str
    category_display: str
    value: Decimal | None
    value_text: str
    item_label: str
    unit: str
    statistical_year: int
    period: str
    period_display: str
    period_number: int | None
    source: str
    source_url: str
    source_published_at: date | None
    collected_at: date | None
    notes: str


class StatisticIndicatorOut(Schema):
    value: str
    label: str
    category: str
    category_display: str


class ProvinceDetailOut(ProvinceOut):
    short_description: str
    description: str
    economic_description: str
    area_sq_km: Decimal | None
    population: int | None
    latitude: Decimal | None
    longitude: Decimal | None
    featured_image: str | None
    map_image: str | None
    created_at: datetime
    updated_at: datetime
    capital: CityOut | None
    cities: list[CityOut]
    industries: list[ProvinceIndustryOut]
    statistics: list[ProvinceStatisticsOut]
