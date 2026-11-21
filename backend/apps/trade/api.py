from datetime import date
from decimal import Decimal
from math import ceil

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Prefetch, QuerySet
from django.http import HttpRequest
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_protect
from ninja import Query, Router, Status
from ninja.decorators import decorate_view
from ninja.errors import HttpError

from apps.core.errors import ApiError
from apps.geography.models import City, Province
from apps.organizations.models import Industry, IndustryCategory, Organization, Product

from . import selectors
from .models import OpportunityReviewStatus, OpportunityType, TradeOpportunity
from .schemas import (
    TradeIndustryOptionOut,
    TradeOpportunityCreateIn,
    TradeOpportunityOut,
    TradeOpportunityPageOut,
    TradeOpportunitySearchPageOut,
    TradeOptionsOut,
    TradeProductOptionOut,
    TradeSubmissionOut,
)
from .search import (
    SearchInterpretation,
    has_verified_contact,
    interpret_search_query,
    opportunity_search_score,
)

router = Router()


def opportunity_data(item: TradeOpportunity) -> dict[str, object]:
    city = item.city
    product = item.product
    service_listing = item.service_listing
    industry = item.industry
    company = item.company
    return {
        "id": item.pk,
        "title": item.title,
        "slug": item.slug,
        "province_slug": item.province.slug,
        "province_name_fa": item.province.name_fa,
        "city_name_fa": city.name_fa if city else None,
        "product_slug": (
            service_listing.slug if service_listing else product.slug if product else None
        ),
        "product_name_fa": (
            service_listing.title if service_listing else product.name_fa if product else None
        ),
        "service_listing_slug": service_listing.slug if service_listing else None,
        "industry_slug": industry.slug if industry else None,
        "industry_name_fa": industry.name_fa if industry else None,
        "opportunity_type": item.opportunity_type,
        "opportunity_type_display": item.get_opportunity_type_display(),
        "description": item.description,
        "target_market": item.target_market,
        "required_volume": item.required_volume,
        "volume_unit": item.volume_unit,
        "min_value": item.min_value,
        "max_value": item.max_value,
        "currency": item.currency,
        "company": (
            {"id": company.pk, "slug": company.slug, "name": company.name}
            if company
            else None
        ),
        "source": item.source,
        "source_url": item.source_url,
        "published_at": item.published_at,
        "valid_until": item.valid_until,
        "review_status": item.review_status,
        "review_status_display": item.get_review_status_display(),
        "is_published": item.is_published,
        "relevance_score": item.relevance_score,
        "last_reviewed_at": item.last_reviewed_at,
        "created_at": item.created_at,
    }


@router.get("/options/", response=TradeOptionsOut, operation_id="trade_opportunity_options")
def opportunity_options(request: HttpRequest) -> dict[str, object]:
    companies: QuerySet[Organization] = Organization.objects.none()
    if request.user.is_authenticated:
        companies = Organization.objects.filter(
            members=request.user,
            is_active=True,
        ).order_by("name")
    return {
        "provinces": Province.objects.filter(
            country__iso2="IR", is_published=True
        ).values("id", "slug", "name_fa"),
        "products": [
            TradeProductOptionOut(
                id=product.pk,
                slug=product.slug,
                name_fa=product.name_fa,
                name_en=product.name_en,
                industry_slugs=[industry.slug for industry in product.industries.all()],
            )
            for product in Product.objects.filter(industries__is_published=True)
            .distinct()
            .prefetch_related(
                Prefetch(
                    "industries",
                    queryset=Industry.objects.filter(is_published=True).only("slug"),
                )
            )
        ],
        "industries": [
            TradeIndustryOptionOut(
                id=industry.pk,
                slug=industry.slug,
                name_fa=industry.name_fa,
                name_en=industry.name_en,
                category=industry.category,
                category_display=industry.get_category_display(),
            )
            for industry in Industry.objects.filter(is_published=True)
        ],
        "companies": [
            {"id": item.pk, "slug": item.slug, "name": item.name} for item in companies
        ],
        "opportunity_types": [
            {"value": value, "label": label} for value, label in OpportunityType.choices
        ],
    }


def search_opportunity_data(item: TradeOpportunity) -> dict[str, object]:
    data = opportunity_data(item)
    company = item.company
    return {
        **data,
        "company": (
            {"id": company.pk, "slug": company.slug, "name": company.name}
            if company and company.is_active and company.is_verified
            else None
        ),
        "match_score": int(getattr(item, "_search_score", 0)),
        "has_verified_contact": has_verified_contact(company),
    }


@router.get(
    "/opportunities/",
    response=TradeOpportunityPageOut,
    operation_id="trade_opportunities_list",
)
def list_opportunities(
    request: HttpRequest,
    province: str = "",
    product: str = "",
    industry: str = "",
    opportunity_type: OpportunityType | None = None,
    q: str = "",
    ordering: str = Query("newest", pattern="^(newest|relevance)$"),  # type: ignore[type-arg]
    page: int = Query(1, ge=1),  # type: ignore[type-arg]
    page_size: int = Query(12, ge=1, le=50),  # type: ignore[type-arg]
) -> dict[str, object]:
    opportunities = selectors.public_opportunities(
        province=province.strip(),
        product=product.strip(),
        industry=industry.strip(),
        opportunity_type=opportunity_type or "",
        query=q.strip(),
        ordering=ordering,
    )
    count = opportunities.count()
    start = (page - 1) * page_size
    return {
        "results": [opportunity_data(item) for item in opportunities[start : start + page_size]],
        "count": count,
        "page": page,
        "page_size": page_size,
        "total_pages": ceil(count / page_size),
    }


@router.get(
    "/opportunities/search/",
    response=TradeOpportunitySearchPageOut,
    operation_id="trade_opportunities_search",
)
def search_opportunities(
    request: HttpRequest,
    q: str = Query("", max_length=200),
    province: str = "",
    city: str = "",
    category: str = "",
    opportunity_type: OpportunityType | None = None,
    product: str = "",
    status: str = Query("active", pattern="^(active|expiring)$"),
    min_quantity: Decimal | None = Query(None, ge=0),  # noqa: B008
    max_quantity: Decimal | None = Query(None, ge=0),  # noqa: B008
    volume_unit: str = "",
    date_from: date | None = None,
    date_to: date | None = None,
    has_contact: bool = False,
    ordering: str = Query(
        "relevance", pattern="^(relevance|newest|oldest|quantity)$"
    ),
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=50),
) -> dict[str, object]:
    if category and category not in {value for value, _ in IndustryCategory.choices}:
        raise HttpError(422, "Invalid category filter")
    if min_quantity is not None and max_quantity is not None and min_quantity > max_quantity:
        raise HttpError(422, "min_quantity must not exceed max_quantity")
    if date_from and date_to and date_from > date_to:
        raise HttpError(422, "date_from must not be later than date_to")
    if len(city) > 100 or len(province) > 100 or len(product) > 120 or len(volume_unit) > 60:
        raise HttpError(422, "A search filter is too long")

    interpretation = (
        interpret_search_query(q.strip()) if q.strip() else SearchInterpretation(terms=())
    )
    opportunities = opportunity_search_score(
        query=q.strip(),
        interpretation=interpretation,
        province=province.strip(),
        city=city.strip(),
        category=category,
        opportunity_type=opportunity_type or "",
        product=product.strip(),
        status=status,
        min_quantity=min_quantity,
        max_quantity=max_quantity,
        volume_unit=volume_unit.strip(),
        date_from=date_from,
        date_to=date_to,
        has_contact=has_contact,
        ordering=ordering,
    )
    count = opportunities.count()
    start = (page - 1) * page_size
    applied_filters = {
        key: str(value)
        for key, value in {
            "q": q.strip(),
            "province": province.strip(),
            "city": city.strip(),
            "category": category,
            "opportunity_type": opportunity_type or "",
            "product": product.strip(),
            "status": status,
            "min_quantity": min_quantity,
            "max_quantity": max_quantity,
            "volume_unit": volume_unit.strip(),
            "date_from": date_from,
            "date_to": date_to,
            "has_contact": has_contact,
            "ordering": ordering,
        }.items()
        if value not in ("", None, False)
    }
    return {
        "results": [
            search_opportunity_data(item)
            for item in opportunities[start : start + page_size]
        ],
        "count": count,
        "page": page,
        "page_size": page_size,
        "total_pages": ceil(count / page_size),
        "applied_filters": applied_filters,
        "interpreted": {
            "product": interpretation.product,
            "province": interpretation.province,
            "city": interpretation.city,
            "category": interpretation.category,
            "opportunity_type": interpretation.opportunity_type,
            "quantity": interpretation.quantity,
            "quantity_unit": interpretation.quantity_unit,
        },
    }


@router.get(
    "/opportunities/{slug}/",
    response=TradeOpportunityOut,
    operation_id="trade_opportunity_detail",
)
def get_opportunity(request: HttpRequest, slug: str) -> dict[str, object]:
    opportunity = get_object_or_404(selectors.public_opportunities(), slug=slug)
    return opportunity_data(opportunity)


@router.get(
    "/my-opportunities/",
    response=list[TradeOpportunityOut],
    operation_id="trade_my_opportunities",
)
def my_opportunities(request: HttpRequest) -> list[dict[str, object]]:
    if not request.user.is_authenticated:
        raise ApiError("برای مشاهدهٔ فرصت‌های ثبت‌شده وارد حساب شوید.", status_code=401)
    return [opportunity_data(item) for item in selectors.user_opportunities(request.user.pk)]


@router.post(
    "/opportunities/",
    response={201: TradeSubmissionOut},
    operation_id="trade_opportunity_submit",
)
@decorate_view(csrf_protect)
def submit_opportunity(
    request: HttpRequest,
    payload: TradeOpportunityCreateIn,
) -> Status[TradeSubmissionOut]:
    if not request.user.is_authenticated:
        raise ApiError("برای ثبت فرصت تجاری وارد حساب کاربری شوید.", status_code=401)

    province = get_object_or_404(
        Province,
        pk=payload.province_id,
        country__iso2="IR",
        is_published=True,
    )
    city = None
    if payload.city_id:
        city = City.objects.filter(pk=payload.city_id, province=province).first()
        if city is None:
            raise ApiError("شهر انتخاب‌شده با استان انتخابی مطابقت ندارد.")

    product = None
    if payload.product_id:
        product = get_object_or_404(Product, pk=payload.product_id)
    industry = None
    if payload.industry_id:
        industry = get_object_or_404(Industry, pk=payload.industry_id, is_published=True)
    if product and industry and not industry.products.filter(pk=product.pk).exists():
        raise ApiError("محصول انتخاب‌شده به صنعت انتخابی مرتبط نیست.")

    company = None
    if payload.company_id:
        company = Organization.objects.filter(
            pk=payload.company_id,
            members=request.user,
            is_active=True,
        ).first()
        if company is None:
            raise ApiError(
                "فقط می‌توانید از طرف شرکت‌های متصل به حساب خود فرصت ثبت کنید.",
                status_code=403,
            )

    opportunity = TradeOpportunity(
        title=payload.title.strip(),
        province=province,
        city=city,
        product=product,
        industry=industry,
        opportunity_type=payload.opportunity_type,
        description=payload.description.strip(),
        target_market=payload.target_market.strip(),
        required_volume=payload.required_volume,
        volume_unit=payload.volume_unit.strip(),
        min_value=payload.min_value,
        max_value=payload.max_value,
        currency=payload.currency.strip(),
        company=company,
        source=payload.source.strip(),
        source_url=payload.source_url.strip(),
        valid_until=payload.valid_until,
        created_by=request.user,
        review_status=OpportunityReviewStatus.PENDING,
        is_published=False,
        relevance_score=0,
    )
    try:
        opportunity.full_clean()
    except DjangoValidationError as exc:
        if hasattr(exc, "message_dict"):
            message = " ".join(
                f"{field}: {' '.join(messages)}"
                for field, messages in exc.message_dict.items()
            )
        else:
            message = " ".join(exc.messages)
        raise ApiError(message) from exc
    opportunity.save()
    return Status(
        201,
        TradeSubmissionOut(
            id=opportunity.pk,
            slug=opportunity.slug,
            review_status=opportunity.review_status,
            message="فرصت شما ثبت شد و پس از بررسی مدیر منتشر خواهد شد.",
        ),
    )
