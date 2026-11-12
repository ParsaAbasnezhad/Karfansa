from datetime import datetime
from decimal import Decimal

from ninja import Schema
from pydantic import Field


class CategoryOut(Schema):
    id: int
    name: str
    slug: str
    description: str
    parent_id: int | None
    children: list["CategoryOut"] = Field(default_factory=list)


class SellerProfileIn(Schema):
    display_name: str = Field(min_length=2, max_length=120)
    bio: str = Field(default="", max_length=1500)
    province_id: int | None = None
    city_id: int | None = None
    is_public: bool = True


class SellerOut(Schema):
    id: int
    display_name: str
    bio: str
    province_id: int | None
    city_id: int | None
    province_name: str | None
    city_name: str | None
    is_public: bool


class SpecificationIn(Schema):
    name: str = Field(min_length=1, max_length=100)
    value: str = Field(min_length=1, max_length=250)


class ListingIn(Schema):
    category_id: int = Field(gt=0)
    province_id: int = Field(gt=0)
    city_id: int | None = None
    title: str = Field(min_length=3, max_length=180)
    description: str = Field(min_length=10, max_length=5000)
    sale_mode: str = "both"
    quantity: Decimal = Field(gt=0)
    unit: str = Field(min_length=1, max_length=40)
    price: Decimal | None = Field(default=None, ge=0)
    currency: str = "IRR"
    is_price_negotiable: bool = False
    minimum_order_quantity: Decimal | None = Field(default=None, gt=0)
    quality: str = Field(default="", max_length=500)
    packaging: str = Field(default="", max_length=500)
    specifications: list[SpecificationIn] = Field(default_factory=list, max_length=30)
    submit_for_review: bool = True


class ListingOut(Schema):
    id: int
    title: str
    slug: str
    description: str
    category_id: int
    category_name: str
    category_slug: str
    seller: SellerOut
    province_id: int
    province_name: str
    province_slug: str
    city_id: int | None
    city_name: str | None
    sale_mode: str
    sale_mode_display: str
    quantity: Decimal
    unit: str
    price: Decimal | None
    currency: str
    is_price_negotiable: bool
    minimum_order_quantity: Decimal | None
    quality: str
    packaging: str
    is_export_available: bool
    is_domestic_available: bool
    status: str
    status_display: str
    is_active: bool
    rejection_reason: str
    images: list[dict[str, object]]
    specifications: list[dict[str, object]]
    created_at: datetime
    updated_at: datetime
    published_at: datetime | None


class ListingPageOut(Schema):
    results: list[ListingOut]
    count: int
    page: int
    page_size: int
    total_pages: int


class InquiryIn(Schema):
    message: str = Field(min_length=5, max_length=2000)
    quantity: Decimal | None = Field(default=None, gt=0)


class InquiryStatusIn(Schema):
    status: str


class InquiryOut(Schema):
    id: int
    listing_id: int
    listing_title: str
    listing_slug: str
    buyer_name: str
    message: str
    quantity: Decimal | None
    status: str
    status_display: str
    created_at: datetime
    updated_at: datetime


class DashboardOut(Schema):
    profile: SellerOut
    listings_total: int
    listings_pending: int
    listings_approved: int
    inquiries_new: int
