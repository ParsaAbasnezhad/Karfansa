"""Public directory API for individual business profiles."""

from math import ceil

from django.db.models import Count, Q, QuerySet
from django.http import HttpRequest
from django.shortcuts import get_object_or_404
from ninja import Query, Router

from apps.core.verification import VerificationStatus
from apps.services.models import ProductListing, SellerProfile
from apps.services.schemas import IndividualDirectoryOut, IndividualPageOut

router = Router()


def _public_individuals() -> QuerySet[SellerProfile]:
    return (
        SellerProfile.objects.filter(is_public=True)
        .exclude(verification_status=VerificationStatus.SUSPENDED)
        .select_related("province", "city")
        .annotate(
            listings_count=Count(
                "listings",
                filter=Q(
                    listings__status=ProductListing.Status.APPROVED,
                    listings__is_active=True,
                    listings__organization__isnull=True,
                    listings__category__is_active=True,
                ),
            )
        )
        .order_by("-updated_at", "display_name")
    )


def _individual_data(profile: SellerProfile) -> IndividualDirectoryOut:
    province = profile.province
    city = profile.city
    return IndividualDirectoryOut.model_validate(
        {
            "id": profile.pk,
            "display_name": profile.display_name,
            "professional_title": profile.professional_title,
            "bio": profile.bio,
            "profile_image": profile.profile_image.url if profile.profile_image else None,
            "cover_image": profile.cover_image.url if profile.cover_image else None,
            "province_id": profile.province_id,
            "city_id": profile.city_id,
            "province_name": province.name_fa if province else None,
            "city_name": city.name_fa if city else None,
            "province_slug": province.slug if province else None,
            "is_public": profile.is_public,
            "is_verified": profile.verification_status == VerificationStatus.VERIFIED,
            "listings_count": int(getattr(profile, "listings_count", 0) or 0),
        }
    )


@router.get("/", response=IndividualPageOut, operation_id="individuals_list")
def list_individuals(
    request: HttpRequest,
    q: str = Query("", max_length=200),  # type: ignore[type-arg]
    province: str = "",
    city: str = "",
    verified: bool | None = None,
    page: int = Query(1, ge=1),  # type: ignore[type-arg]
    page_size: int = Query(12, ge=1, le=50),  # type: ignore[type-arg]
) -> IndividualPageOut:
    queryset = _public_individuals()
    query = q.strip()
    if query:
        queryset = queryset.filter(
            Q(display_name__icontains=query)
            | Q(professional_title__icontains=query)
            | Q(bio__icontains=query)
        )
    if province:
        queryset = (
            queryset.filter(province_id=int(province))
            if province.isdigit()
            else queryset.filter(province__slug=province)
        )
    if city:
        queryset = (
            queryset.filter(city_id=int(city))
            if city.isdigit()
            else queryset.filter(city__slug=city)
        )
    if verified is True:
        queryset = queryset.filter(verification_status=VerificationStatus.VERIFIED)
    if verified is False:
        queryset = queryset.exclude(verification_status=VerificationStatus.VERIFIED)
    count = queryset.count()
    start = (page - 1) * page_size
    return IndividualPageOut.model_validate(
        {
            "results": [_individual_data(item) for item in queryset[start : start + page_size]],
            "count": count,
            "page": page,
            "page_size": page_size,
            "total_pages": max(ceil(count / page_size), 1) if count else 0,
        }
    )


@router.get(
    "/{individual_id}/",
    response=IndividualDirectoryOut,
    operation_id="individuals_detail",
)
def individual_detail(request: HttpRequest, individual_id: int) -> IndividualDirectoryOut:
    profile = get_object_or_404(_public_individuals(), pk=individual_id)
    return _individual_data(profile)
