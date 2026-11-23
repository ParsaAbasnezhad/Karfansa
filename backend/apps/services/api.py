from decimal import Decimal
from math import ceil
from typing import Any

from django.core.cache import cache
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import Q, QuerySet
from django.http import HttpRequest
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.csrf import csrf_protect
from ninja import File, Query, Router, Status, UploadedFile
from ninja.decorators import decorate_view
from ninja.errors import HttpError

from apps.accounts.models import User
from apps.core.errors import ApiError
from apps.core.verification import VerificationStatus
from apps.geography.models import City, Province
from apps.organizations.access import can_edit_listing, identity_or_default
from apps.organizations.models import MembershipStatus, Organization

from .integrations import sync_product_opportunity
from .models import (
    InquiryStatusEvent,
    ListingImage,
    ProductInquiry,
    ProductListing,
    ProductSpecification,
    SellerProfile,
    ServiceCategory,
)
from .schemas import (
    CategoryOut,
    DashboardOut,
    InquiryIn,
    InquiryOut,
    InquiryStatusIn,
    ListingIn,
    ListingOut,
    ListingPageOut,
    SellerOut,
    SellerProfileIn,
    SpecificationIn,
)
from .search import normalize_search_text

router = Router()


def require_user(request: HttpRequest) -> User:
    if not request.user.is_authenticated:
        raise ApiError("برای ادامه وارد حساب کاربری شوید.", status_code=401)
    return request.user


def _seller_data(profile: SellerProfile) -> SellerOut:
    province = profile.province
    city = profile.city
    return SellerOut.model_validate({
        "id": profile.pk,
        "display_name": profile.display_name,
        "bio": profile.bio,
        "province_id": profile.province_id,
        "city_id": profile.city_id,
        "province_name": province.name_fa if province else None,
        "city_name": city.name_fa if city else None,
        "is_public": profile.is_public,
        "professional_title": profile.professional_title,
        "profile_image": profile.profile_image.url if profile.profile_image else None,
        "cover_image": profile.cover_image.url if profile.cover_image else None,
        "is_verified": profile.verification_status == VerificationStatus.VERIFIED,
        "listings_count": 0,
        "organization_slug": None,
    })


def _public_seller(listing: ProductListing) -> SellerOut:
    organization = listing.organization
    if organization is not None:
        return SellerOut.model_validate({
            "id": listing.seller_id or 0,
            "display_name": organization.name,
            "bio": organization.description[:1500],
            "province_id": organization.province_id,
            "city_id": organization.city_id,
            "province_name": organization.province.name_fa if organization.province_id else None,
            "city_name": organization.city.name_fa if organization.city_id else None,
            "is_public": organization.is_active,
            "professional_title": organization.get_organization_type_display(),
            "profile_image": organization.logo.url if organization.logo else None,
            "cover_image": organization.cover_image.url if organization.cover_image else None,
            "is_verified": organization.is_verified,
            "listings_count": 0,
            "organization_slug": organization.slug,
        })
    if listing.seller is None:
        raise ApiError("فروشنده این آگهی مشخص نیست.", status_code=404)
    return _seller_data(listing.seller)


def _public_listing_queryset() -> QuerySet[ProductListing]:
    approved = Q(status=ProductListing.Status.APPROVED, is_active=True, category__is_active=True)
    individual = Q(organization__isnull=True, seller__is_public=True)
    company = Q(organization__isnull=False, organization__is_active=True)
    return _listing_queryset().filter(approved & (individual | company))


def _listing_data(listing: ProductListing) -> ListingOut:
    city = listing.city
    organization = listing.organization
    return ListingOut.model_validate({
        "id": listing.pk,
        "title": listing.title,
        "slug": listing.slug,
        "description": listing.description,
        "category_id": listing.category_id,
        "category_name": listing.category.name,
        "category_slug": listing.category.slug,
        "seller": _public_seller(listing),
        "listing_kind": listing.listing_kind,
        "organization_id": str(organization.pk) if organization else None,
        "organization_name": organization.name if organization else None,
        "organization_slug": organization.slug if organization else None,
        "province_id": listing.province_id,
        "province_name": listing.province.name_fa,
        "province_slug": listing.province.slug,
        "city_id": listing.city_id,
        "city_name": city.name_fa if city else None,
        "sale_mode": listing.sale_mode,
        "sale_mode_display": listing.get_sale_mode_display(),
        "quantity": listing.quantity,
        "unit": listing.unit,
        "price": listing.price,
        "currency": listing.currency,
        "is_price_negotiable": listing.is_price_negotiable,
        "minimum_order_quantity": listing.minimum_order_quantity,
        "quality": listing.quality,
        "packaging": listing.packaging,
        "is_export_available": listing.is_export_available,
        "is_domestic_available": listing.is_domestic_available,
        "status": listing.status,
        "status_display": listing.get_status_display(),
        "is_active": listing.is_active,
        "rejection_reason": listing.rejection_reason,
        "images": [
            {
                "id": image.pk,
                "url": image.image.url,
                "alt_text": image.alt_text,
                "sort_order": image.sort_order,
            }
            for image in listing.images.all()
        ],
        "specifications": [
            {"id": item.pk, "name": item.name, "value": item.value}
            for item in listing.specifications.all()
        ],
        "created_at": listing.created_at,
        "updated_at": listing.updated_at,
        "published_at": listing.published_at,
    })


def _listing_queryset() -> QuerySet[ProductListing]:
    return ProductListing.objects.select_related(
        "category",
        "seller",
        "seller__province",
        "seller__city",
        "organization",
        "organization__province",
        "organization__city",
        "province",
        "city",
    ).prefetch_related("images", "specifications")


def _category_tree(
    category: ServiceCategory, children: dict[int | None, list[ServiceCategory]]
) -> CategoryOut:
    return CategoryOut.model_validate({
        "id": category.pk,
        "name": category.name,
        "slug": category.slug,
        "description": category.description,
        "parent_id": category.parent_id,
        "children": [_category_tree(child, children) for child in children.get(category.pk, [])],
    })


@router.get("/categories/", response=list[CategoryOut], operation_id="services_categories")
def categories(request: HttpRequest) -> list[CategoryOut]:
    items = list(ServiceCategory.objects.filter(is_active=True).order_by("sort_order", "name"))
    children: dict[int | None, list[ServiceCategory]] = {}
    for item in items:
        children.setdefault(item.parent_id, []).append(item)
    return [_category_tree(item, children) for item in children.get(None, [])]


@router.get(
    "/categories/{slug}",
    response=CategoryOut,
    operation_id="services_category_detail",
)
def category_detail(request: HttpRequest, slug: str) -> CategoryOut:
    category = get_object_or_404(ServiceCategory, slug=slug, is_active=True)
    items = list(ServiceCategory.objects.filter(is_active=True).order_by("sort_order", "name"))
    children: dict[int | None, list[ServiceCategory]] = {}
    for item in items:
        children.setdefault(item.parent_id, []).append(item)
    return _category_tree(category, children)


@router.get("/listings/", response=ListingPageOut, operation_id="services_listings")
def listings(
    request: HttpRequest,
    q: str = Query("", max_length=200),  # type: ignore[type-arg]
    category: str = "",
    province: str = "",
    city: str = "",
    seller: int | None = None,
    organization: str = "",
    listing_kind: str = "",
    export: bool | None = None,
    domestic: bool | None = None,
    min_price: Decimal | None = Query(None, ge=0),  # type: ignore[type-arg]  # noqa: B008
    max_price: Decimal | None = Query(None, ge=0),  # type: ignore[type-arg]  # noqa: B008
    min_quantity: Decimal | None = Query(None, ge=0),  # type: ignore[type-arg]  # noqa: B008
    max_quantity: Decimal | None = Query(None, ge=0),  # type: ignore[type-arg]  # noqa: B008
    page: int = Query(1, ge=1),  # type: ignore[type-arg]
    page_size: int = Query(12, ge=1, le=50),  # type: ignore[type-arg]
) -> ListingPageOut:
    if min_price is not None and max_price is not None and min_price > max_price:
        raise HttpError(422, "min_price must not exceed max_price")
    if min_quantity is not None and max_quantity is not None and min_quantity > max_quantity:
        raise HttpError(422, "min_quantity must not exceed max_quantity")
    queryset = _public_listing_queryset()
    if category:
        category_item = ServiceCategory.objects.filter(slug=category, is_active=True).first()
        if category_item:
            category_ids = {category_item.pk, *category_item.get_descendant_ids()}
            queryset = queryset.filter(category_id__in=category_ids)
        else:
            queryset = queryset.none()
    if province:
        queryset = (
            queryset.filter(province_id=int(province))
            if province.isdecimal()
            else queryset.filter(province__slug=province)
        )
    if city:
        queryset = (
            queryset.filter(city_id=int(city))
            if city.isdecimal()
            else queryset.filter(city__slug=city)
        )
    if seller is not None:
        queryset = queryset.filter(seller_id=seller, organization__isnull=True)
    if organization:
        from uuid import UUID

        try:
            UUID(organization)
        except ValueError:
            queryset = queryset.filter(organization__slug=organization)
        else:
            queryset = queryset.filter(organization_id=organization)
    if listing_kind:
        if listing_kind not in ProductListing.Kind.values:
            raise HttpError(422, "listing_kind must be product or service")
        queryset = queryset.filter(listing_kind=listing_kind)
    if export is True:
        queryset = queryset.filter(sale_mode__in=["export", "both"])
    if export is False:
        queryset = queryset.exclude(sale_mode__in=["export", "both"])
    if domestic is True:
        queryset = queryset.filter(sale_mode__in=["domestic", "both"])
    if domestic is False:
        queryset = queryset.exclude(sale_mode__in=["domestic", "both"])
    if min_price is not None:
        queryset = queryset.filter(price__gte=min_price)
    if max_price is not None:
        queryset = queryset.filter(price__lte=max_price)
    if min_quantity is not None:
        queryset = queryset.filter(quantity__gte=min_quantity)
    if max_quantity is not None:
        queryset = queryset.filter(quantity__lte=max_quantity)
    normalized_query = normalize_search_text(q)
    if normalized_query:
        queryset = queryset.filter(models_q_search(normalized_query))
    count = queryset.count()
    start = (page - 1) * page_size
    return ListingPageOut.model_validate({
        "results": [_listing_data(item) for item in queryset[start : start + page_size]],
        "count": count,
        "page": page,
        "page_size": page_size,
        "total_pages": ceil(count / page_size),
    })


def models_q_search(query: str) -> Any:
    from django.db.models import Q

    terms = [term for term in query.split() if len(term) > 1]
    if not terms:
        return Q(pk__in=[])
    condition = Q()
    for term in terms:
        condition &= Q(normalized_title__contains=term) | Q(normalized_description__contains=term)
    return condition


@router.get("/listings/{slug}", response=ListingOut, operation_id="services_listing_detail")
def listing_detail(request: HttpRequest, slug: str) -> ListingOut:
    listing = get_object_or_404(_public_listing_queryset(), slug=slug)
    return _listing_data(listing)


@router.get("/sellers/{seller_id}", response=SellerOut, operation_id="services_seller_detail")
def seller_detail(request: HttpRequest, seller_id: int) -> SellerOut:
    profile = get_object_or_404(SellerProfile, pk=seller_id, is_public=True)
    return _seller_data(profile)


@router.get(
    "/seller/profile",
    response={200: SellerOut, 404: dict[str, str]},
    operation_id="services_seller_profile",
)
def seller_profile(
    request: HttpRequest,
) -> SellerOut | tuple[int, dict[str, str]]:
    user = require_user(request)
    profile = SellerProfile.objects.filter(user=user).first()
    if profile is None:
        return 404, {"message": "پروفایل فروشندگی ثبت نشده است."}
    return _seller_data(profile)


@router.put(
    "/seller/profile",
    response=SellerOut,
    operation_id="services_seller_profile_update",
)
@decorate_view(csrf_protect)
def update_seller_profile(request: HttpRequest, payload: SellerProfileIn) -> SellerOut:
    user = require_user(request)
    province = None
    if payload.province_id:
        province = get_object_or_404(Province, pk=payload.province_id)
    city = None
    if payload.city_id:
        city = City.objects.filter(pk=payload.city_id, province=province).first()
        if city is None:
            raise ApiError("شهر باید متعلق به استان انتخاب‌شده باشد.")
    profile, _ = SellerProfile.objects.get_or_create(
        user=user, defaults={"display_name": payload.display_name.strip()}
    )
    profile.display_name = payload.display_name.strip()
    profile.bio = payload.bio.strip()
    profile.province = province
    profile.city = city
    profile.is_public = payload.is_public
    if profile.verification_status == VerificationStatus.SUSPENDED:
        profile.is_public = False
    try:
        profile.full_clean()
    except DjangoValidationError as exc:
        raise ApiError("اطلاعات پروفایل معتبر نیست.") from exc
    profile.save()
    return _seller_data(profile)


def _profile_for_user(user: User) -> SellerProfile:
    profile = SellerProfile.objects.filter(user=user).first()
    if profile is None:
        raise ApiError(
            "ابتدا پروفایل فروشندگی خود را تکمیل کنید.",
            status_code=403,
        )
    return profile


def _save_specifications(
    listing: ProductListing, specifications: list[SpecificationIn]
) -> None:
    names: set[str] = set()
    for spec in specifications:
        name = spec.name.strip()
        if name in names:
            raise ApiError("نام مشخصه‌های محصول نباید تکراری باشد.")
        names.add(name)
    listing.specifications.all().delete()
    ProductSpecification.objects.bulk_create(
        [
            ProductSpecification(listing=listing, name=item.name.strip(), value=item.value.strip())
            for item in specifications
        ]
    )


def _listing_fields(payload: ListingIn) -> dict[str, Any]:
    category = get_object_or_404(ServiceCategory, pk=payload.category_id, is_active=True)
    province = get_object_or_404(Province, pk=payload.province_id, country__iso2="IR")
    city = None
    if payload.city_id:
        city = City.objects.filter(pk=payload.city_id, province=province).first()
        if city is None:
            raise ApiError("شهر انتخاب‌شده با استان انتخابی مطابقت ندارد.")
    if payload.sale_mode not in ProductListing.SaleMode.values:
        raise ApiError("نوع فروش انتخاب‌شده معتبر نیست.")
    if payload.listing_kind not in ProductListing.Kind.values:
        raise ApiError("نوع آگهی معتبر نیست.")
    return {
        "category": category,
        "province": province,
        "city": city,
        "title": payload.title.strip(),
        "description": payload.description.strip(),
        "sale_mode": payload.sale_mode,
        "quantity": payload.quantity,
        "unit": payload.unit.strip(),
        "price": payload.price,
        "currency": payload.currency.strip().upper() if payload.price is not None else "",
        "is_price_negotiable": payload.is_price_negotiable,
        "minimum_order_quantity": payload.minimum_order_quantity,
        "quality": payload.quality.strip(),
        "packaging": payload.packaging.strip(),
        "listing_kind": payload.listing_kind,
    }


@router.get("/my/listings", response=list[ListingOut], operation_id="services_my_listings")
def my_listings(request: HttpRequest) -> list[ListingOut]:
    profile = _profile_for_user(require_user(request))
    return [
        _listing_data(item)
        for item in _listing_queryset().filter(seller=profile).order_by("-updated_at")
    ]


def _listing_owner(request: HttpRequest) -> tuple[SellerProfile | None, Organization | None]:
    user = require_user(request)
    active = identity_or_default(request, user)
    if active is not None and active.organization is not None:
        if active.role not in {"owner", "admin", "manager"}:
            raise ApiError("نقش شما اجازه انتشار آگهی را نمی‌دهد.", status_code=403)
        if (
            active.organization.verification_status == VerificationStatus.SUSPENDED
            or not active.organization.is_active
        ):
            raise ApiError("شرکت تعلیق‌شده اجازه انتشار ندارد.", status_code=403)
        return None, active.organization
    profile = _profile_for_user(user)
    if profile.verification_status == VerificationStatus.SUSPENDED:
        raise ApiError("پروفایل تعلیق‌شده اجازه انتشار ندارد.", status_code=403)
    return profile, None


def _editable_listing(request: HttpRequest, listing_id: int) -> ProductListing:
    user = require_user(request)
    listing = get_object_or_404(ProductListing.objects.select_related("seller"), pk=listing_id)
    if not can_edit_listing(user, listing):
        raise ApiError("آگهی پیدا نشد.", status_code=404)
    if listing.seller_id and listing.seller.verification_status == VerificationStatus.SUSPENDED:
        raise ApiError("پروفایل تعلیق‌شده اجازه ویرایش انتشار را نمی‌دهد.", status_code=403)
    if listing.organization_id and (
        not listing.organization.is_active
        or listing.organization.verification_status == VerificationStatus.SUSPENDED
    ):
        raise ApiError("شرکت تعلیق‌شده اجازه ویرایش انتشار را نمی‌دهد.", status_code=403)
    return listing


@router.post(
    "/my/listings",
    response={201: ListingOut},
    operation_id="services_listing_create",
)
@decorate_view(csrf_protect)
def create_listing(request: HttpRequest, payload: ListingIn) -> Status[ListingOut]:
    seller, organization = _listing_owner(request)
    values = _listing_fields(payload)
    listing = ProductListing(seller=seller, organization=organization, **values)
    try:
        with transaction.atomic():
            listing.full_clean()
            listing.save()
            if payload.submit_for_review:
                listing.transition_to(ProductListing.Status.PENDING_REVIEW)
            _save_specifications(listing, payload.specifications)
            sync_product_opportunity(listing)
    except DjangoValidationError as exc:
        raise ApiError("اطلاعات محصول معتبر نیست.") from exc
    return Status(201, _listing_data(_listing_queryset().get(pk=listing.pk)))


@router.put(
    "/my/listings/{listing_id}",
    response=ListingOut,
    operation_id="services_listing_update",
)
@decorate_view(csrf_protect)
def update_listing(request: HttpRequest, listing_id: int, payload: ListingIn) -> ListingOut:
    listing = _editable_listing(request, listing_id)
    listing = _listing_queryset().get(pk=listing.pk)
    values = _listing_fields(payload)
    try:
        with transaction.atomic():
            if listing.status in {ProductListing.Status.APPROVED, ProductListing.Status.REJECTED}:
                listing.transition_to(ProductListing.Status.PENDING_REVIEW)
            elif listing.status == ProductListing.Status.ARCHIVED:
                listing.transition_to(ProductListing.Status.DRAFT)
            if (
                not payload.submit_for_review
                and listing.status == ProductListing.Status.PENDING_REVIEW
            ):
                listing.transition_to(ProductListing.Status.DRAFT)
            elif payload.submit_for_review and listing.status == ProductListing.Status.DRAFT:
                listing.transition_to(ProductListing.Status.PENDING_REVIEW)
            for field, value in values.items():
                setattr(listing, field, value)
            listing.full_clean()
            listing.save()
            _save_specifications(listing, payload.specifications)
            sync_product_opportunity(listing)
    except DjangoValidationError as exc:
        raise ApiError("اطلاعات محصول معتبر نیست.") from exc
    return _listing_data(_listing_queryset().get(pk=listing.pk))


@router.post(
    "/my/listings/{listing_id}/archive",
    response={200: dict[str, str]},
    operation_id="services_listing_archive",
)
@decorate_view(csrf_protect)
def archive_listing(request: HttpRequest, listing_id: int) -> tuple[int, dict[str, str]]:
    listing = _editable_listing(request, listing_id)
    try:
        listing.transition_to(ProductListing.Status.ARCHIVED)
        sync_product_opportunity(listing)
    except DjangoValidationError as exc:
        raise ApiError("محصول را نمی‌توان بایگانی کرد.") from exc
    return 200, {"message": "محصول بایگانی شد."}


@router.post(
    "/my/listings/{listing_id}/images",
    response={201: dict[str, object]},
    operation_id="services_listing_image_upload",
)
@decorate_view(csrf_protect)
def upload_listing_image(
    request: HttpRequest,
    listing_id: int,
    file: UploadedFile = File(...),  # type: ignore[type-arg]  # noqa: B008
    alt_text: str = "",
) -> Status[dict[str, object]]:
    listing = _editable_listing(request, listing_id)
    if listing.images.count() >= 10:
        raise ApiError("برای هر محصول حداکثر 10 تصویر می‌توان ثبت کرد.")
    image = ListingImage(listing=listing, image=file, alt_text=alt_text[:160])
    try:
        image.full_clean()
        if listing.status == ProductListing.Status.APPROVED:
            listing.transition_to(ProductListing.Status.PENDING_REVIEW)
        image.save()
    except DjangoValidationError as exc:
        raise ApiError("تصویر معتبر نیست؛ فرمت JPG، PNG یا WebP و حداکثر ۲ مگابایت باشد.") from exc
    return Status(
        201,
        {"id": image.pk, "url": image.image.url, "alt_text": image.alt_text},
    )


@router.delete(
    "/my/images/{image_id}",
    response={200: dict[str, str]},
    operation_id="services_listing_image_delete",
)
@decorate_view(csrf_protect)
def delete_listing_image(request: HttpRequest, image_id: int) -> tuple[int, dict[str, str]]:
    user = require_user(request)
    image = get_object_or_404(ListingImage.objects.select_related("listing__seller"), pk=image_id)
    if not can_edit_listing(user, image.listing):
        raise ApiError("تصویر پیدا نشد.", status_code=404)
    if image.listing.status == ProductListing.Status.APPROVED:
        image.listing.transition_to(ProductListing.Status.PENDING_REVIEW)
    image.image.delete(save=False)
    image.delete()
    return 200, {"message": "تصویر حذف شد."}


@router.get("/dashboard", response=DashboardOut, operation_id="services_seller_dashboard")
def seller_dashboard(request: HttpRequest) -> DashboardOut:
    profile = _profile_for_user(require_user(request))
    listings = ProductListing.objects.filter(seller=profile)
    return DashboardOut.model_validate({
        "profile": _seller_data(profile),
        "listings_total": listings.count(),
        "listings_pending": listings.filter(status=ProductListing.Status.PENDING_REVIEW).count(),
        "listings_approved": listings.filter(status=ProductListing.Status.APPROVED).count(),
        "inquiries_new": ProductInquiry.objects.filter(
            listing__seller=profile, status=ProductInquiry.Status.NEW
        ).count(),
    })


def _inquiry_data(inquiry: ProductInquiry) -> InquiryOut:
    buyer = inquiry.buyer
    buyer_name = f"{buyer.first_name} {buyer.last_name}".strip() or "خریدار کارفنسا"
    return InquiryOut.model_validate({
        "id": inquiry.pk,
        "listing_id": inquiry.listing_id,
        "listing_title": inquiry.listing.title,
        "listing_slug": inquiry.listing.slug,
        "buyer_name": buyer_name,
        "message": inquiry.message,
        "quantity": inquiry.quantity,
        "status": inquiry.status,
        "status_display": inquiry.get_status_display(),
        "created_at": inquiry.created_at,
        "updated_at": inquiry.updated_at,
    })


@router.get(
    "/inquiries/received",
    response=list[InquiryOut],
    operation_id="services_inquiries_received",
)
def received_inquiries(request: HttpRequest) -> list[InquiryOut]:
    user = require_user(request)
    from .inquiries_api import _owner_scope

    inquiries = ProductInquiry.objects.filter(
        _owner_scope(request, user), listing__isnull=False
    ).select_related(
        "listing", "buyer"
    )
    return [_inquiry_data(item) for item in inquiries]


@router.get(
    "/inquiries/submitted",
    response=list[InquiryOut],
    operation_id="services_inquiries_submitted",
)
def submitted_inquiries(request: HttpRequest) -> list[InquiryOut]:
    inquiries = ProductInquiry.objects.filter(
        buyer=require_user(request), listing__isnull=False
    ).select_related("listing", "buyer")
    return [_inquiry_data(item) for item in inquiries]


@router.post(
    "/listings/{slug}/inquiries",
    response={201: InquiryOut},
    operation_id="services_inquiry_create",
)
@decorate_view(csrf_protect)
def create_inquiry(request: HttpRequest, slug: str, payload: InquiryIn) -> Status[InquiryOut]:
    buyer = require_user(request)
    listing = get_object_or_404(
        ProductListing.objects.select_related("seller"),
        slug=slug,
        status=ProductListing.Status.APPROVED,
        is_active=True,
    )
    if listing.seller_id and listing.seller.user_id == buyer.pk:
        raise ApiError("نمی‌توانید برای محصول خودتان درخواست بفرستید.")
    if listing.organization_id and buyer.organization_memberships.filter(
        organization_id=listing.organization_id, status=MembershipStatus.ACTIVE
    ).exists():
        raise ApiError("نمی‌توانید برای محصول شرکت خودتان درخواست بفرستید.")
    rate_key = f"legacy-inquiry:{buyer.pk}:{listing.pk}"
    if not cache.add(rate_key, "1", timeout=5):
        raise ApiError("چند لحظه پیش درخواست ارسال کرده‌اید.", status_code=429)
    now = timezone.now()
    inquiry = ProductInquiry(
        listing=listing,
        buyer=buyer,
        message=payload.message.strip(),
        quantity=payload.quantity,
        subject=listing.title[:180],
        category="purchase",
        owner_organization=listing.organization,
        owner_seller=listing.seller,
        applicant_seen_at=now,
        last_activity_at=now,
    )
    try:
        with transaction.atomic():
            inquiry.full_clean()
            inquiry.save()
            from .inquiries_api import _notify

            _notify(inquiry, "new", owner=True)
    except DjangoValidationError as exc:
        cache.delete(rate_key)
        raise ApiError("اطلاعات درخواست معتبر نیست.") from exc
    return Status(
        201,
        _inquiry_data(
            ProductInquiry.objects.select_related("listing", "buyer").get(pk=inquiry.pk)
        ),
    )


@router.patch(
    "/inquiries/{inquiry_id}",
    response=InquiryOut,
    operation_id="services_inquiry_update",
)
@decorate_view(csrf_protect)
def update_inquiry(
    request: HttpRequest, inquiry_id: int, payload: InquiryStatusIn
) -> InquiryOut:
    user = require_user(request)
    from .inquiries_api import _notify, _owner_scope

    allowed: dict[str, set[str]] = {
        ProductInquiry.Status.NEW: {ProductInquiry.Status.READ, ProductInquiry.Status.CLOSED},
        ProductInquiry.Status.READ: {
            ProductInquiry.Status.REPLIED,
            ProductInquiry.Status.CLOSED,
        },
        ProductInquiry.Status.REPLIED: {ProductInquiry.Status.CLOSED},
        ProductInquiry.Status.CLOSED: set(),
    }
    with transaction.atomic():
        inquiry = get_object_or_404(
            ProductInquiry.objects.select_related("listing", "listing__seller", "buyer")
            .select_for_update(of=("self",))
            .filter(_owner_scope(request, user), listing__isnull=False),
            pk=inquiry_id,
        )
        if payload.status not in allowed.get(inquiry.status, set()):
            raise ApiError("تغییر وضعیت درخواست مجاز نیست.")
        old_status = inquiry.status
        now = timezone.now()
        inquiry.status = payload.status
        inquiry.last_activity_at = now
        inquiry.owner_seen_at = now
        inquiry.save(update_fields=["status", "last_activity_at", "owner_seen_at", "updated_at"])
        InquiryStatusEvent.objects.create(
            inquiry=inquiry, actor=user, from_status=old_status, to_status=payload.status
        )
        _notify(inquiry, "status", owner=False)
    return _inquiry_data(inquiry)
