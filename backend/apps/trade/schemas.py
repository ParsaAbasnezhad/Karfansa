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


class TradeProvinceOptionOut(Schema):
    id: int
    slug: str
    name_fa: str


class TradeCatalogOptionOut(Schema):
    id: int
    slug: str
    name_fa: str
    name_en: str


class TradeProductOptionOut(TradeCatalogOptionOut):
    industry_slugs: list[str]


class TradeOptionsOut(Schema):
    provinces: list[TradeProvinceOptionOut]
    products: list[TradeProductOptionOut]
    industries: list[TradeCatalogOptionOut]
    companies: list[TradeCompanyOut]
    opportunity_types: list[dict[str, str]]


class TradeSubmissionOut(Schema):
    id: int
    slug: str
    review_status: str
    message: str


class TradeSort(Schema):
    ordering: Literal["newest", "relevance"] = "newest"
