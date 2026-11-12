from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from ninja import Schema

from .models import OpportunityType


class TradeOpportunityCreateIn(Schema):
    title: str
    province_id: int
    city_id: int | None = None
    product_id: int | None = None
    industry_id: int | None = None
    opportunity_type: OpportunityType
    description: str
    target_market: str = ""
    required_volume: Decimal | None = None
    volume_unit: str = ""
    min_value: Decimal | None = None
    max_value: Decimal | None = None
    currency: str = ""
    company_id: UUID | None = None
    source: str
    source_url: str = ""
    valid_until: date | None = None


class TradeCompanyOut(Schema):
    id: UUID
    slug: str
    name: str


class TradeOpportunityOut(Schema):
    id: int
    title: str
    slug: str
    province_slug: str
    province_name_fa: str
    city_name_fa: str | None
    product_slug: str | None
    product_name_fa: str | None
    service_listing_slug: str | None
    industry_slug: str | None
    industry_name_fa: str | None
    opportunity_type: str
    opportunity_type_display: str
    description: str
    target_market: str
    required_volume: Decimal | None
    volume_unit: str
    min_value: Decimal | None
    max_value: Decimal | None
    currency: str
    company: TradeCompanyOut | None
    source: str
    source_url: str
    published_at: datetime | None
    valid_until: date | None
    review_status: str
    review_status_display: str
    is_published: bool
    relevance_score: int
    last_reviewed_at: datetime | None
    created_at: datetime


class TradeOpportunityPageOut(Schema):
    results: list[TradeOpportunityOut]
    count: int
    page: int
    page_size: int
    total_pages: int


class TradeSearchInterpretationOut(Schema):
    product: str
    province: str
    city: str
    category: str
    opportunity_type: str
    quantity: Decimal | None
    quantity_unit: str


class TradeOpportunitySearchResultOut(TradeOpportunityOut):
    match_score: int
    has_verified_contact: bool


class TradeOpportunitySearchPageOut(Schema):
    results: list[TradeOpportunitySearchResultOut]
    count: int
    page: int
    page_size: int
    total_pages: int
    applied_filters: dict[str, str]
    interpreted: TradeSearchInterpretationOut


class TradeProvinceOptionOut(Schema):
    id: int
    slug: str
    name_fa: str


class TradeCatalogOptionOut(Schema):
    id: int
    slug: str
    name_fa: str
    name_en: str


class TradeIndustryOptionOut(TradeCatalogOptionOut):
    category: str
    category_display: str


class TradeProductOptionOut(TradeCatalogOptionOut):
    industry_slugs: list[str]


class TradeOptionsOut(Schema):
    provinces: list[TradeProvinceOptionOut]
    products: list[TradeProductOptionOut]
    industries: list[TradeIndustryOptionOut]
    companies: list[TradeCompanyOut]
    opportunity_types: list[dict[str, str]]


class TradeSubmissionOut(Schema):
    id: int
    slug: str
    review_status: str
    message: str


class TradeSort(Schema):
    ordering: Literal["newest", "relevance"] = "newest"
