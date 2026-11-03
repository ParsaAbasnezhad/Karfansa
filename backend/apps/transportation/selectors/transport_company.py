from django.db.models import Q, QuerySet
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
    transport_type: str | None = None,
    service_province: str | None = None,
    customs_services: bool | None = None,
    tracking_available: bool | None = None,
    insurance_available: bool | None = None,
    is_verified: bool | None = None,
) -> QuerySet[TransportCompany]:
    queryset = _public()
    if search:
        queryset = queryset.filter(Q(name__icontains=search) | Q(english_name__icontains=search))
    if province:
        queryset = queryset.filter(province__slug=province)
    if transport_type:
        queryset = queryset.filter(transport_types__code=transport_type)
    if service_province:
        queryset = queryset.filter(service_provinces__slug=service_province)
    for field, value in (
        ("customs_services", customs_services),
        ("tracking_available", tracking_available),
        ("insurance_available", insurance_available),
        ("is_verified", is_verified),
    ):
        if value is not None:
            queryset = queryset.filter(**{field: value})
    return queryset.distinct()


def get_public_transport_company(slug: str) -> TransportCompany:
    return get_object_or_404(
        _public().prefetch_related(
            "service_provinces", "origin_countries", "destination_countries"
        ),
        slug=slug,
    )


def list_transport_modes() -> QuerySet[TransportMode]:
    return TransportMode.objects.all()
