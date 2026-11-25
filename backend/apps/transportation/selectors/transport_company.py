from django.db.models import Count, Q, QuerySet
from django.shortcuts import get_object_or_404

from apps.transportation.models import TransportCompany, TransportMode


def _public() -> QuerySet[TransportCompany]:
    return (
        TransportCompany.objects.filter(is_active=True)
        .select_related("country", "province", "city")
        .prefetch_related("transport_types", "vehicle_types")
    )


def list_public_transport_companies(
    *,
    search: str | None = None,
    province: str | None = None,
    city: str | None = None,
    transport_type: str | None = None,
    service_province: str | None = None,
    coverage: str | None = None,
    customs_services: bool | None = None,
    tracking_available: bool | None = None,
    insurance_available: bool | None = None,
    is_verified: bool | None = None,
    ordering: str | None = None,
) -> QuerySet[TransportCompany]:
    queryset = _public()
    if search:
        queryset = queryset.filter(Q(name__icontains=search) | Q(english_name__icontains=search))
    if province:
        queryset = (
            queryset.filter(province_id=int(province))
            if province.isdigit()
            else queryset.filter(province__slug=province)
        )
    if city:
        queryset = (
            queryset.filter(city_id=int(city)) if city.isdigit() else queryset.filter(city__slug=city)
        )
    if transport_type:
        queryset = queryset.filter(transport_types__code=transport_type)
    if service_province:
        queryset = queryset.filter(service_provinces__slug=service_province)
    if coverage == "international":
        queryset = queryset.filter(
            Q(origin_countries__isnull=False) | Q(destination_countries__isnull=False)
        )
    elif coverage == "domestic":
        queryset = queryset.filter(Q(service_provinces__isnull=False) | Q(province__isnull=False))
    for field, value in (
        ("customs_services", customs_services),
        ("tracking_available", tracking_available),
        ("insurance_available", insurance_available),
        ("is_verified", is_verified),
    ):
        if value is not None:
            queryset = queryset.filter(**{field: value})
    queryset = queryset.distinct()
    if ordering == "newest":
        return queryset.order_by("-created_at", "name")
    return queryset.order_by("name")


def get_public_transport_company(slug: str) -> TransportCompany:
    return get_object_or_404(
        _public().prefetch_related(
            "service_provinces", "origin_countries", "destination_countries"
        ),
        slug=slug,
    )


def list_transport_modes() -> QuerySet[TransportMode]:
    return TransportMode.objects.annotate(
        company_count=Count("companies", filter=Q(companies__is_active=True), distinct=True)
    ).order_by("sort_order", "name_fa")
