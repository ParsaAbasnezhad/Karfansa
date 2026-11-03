from django.db.models import Q, QuerySet
from django.shortcuts import get_object_or_404

from apps.organizations.models import Industry, Organization


def _public() -> QuerySet[Organization]:
    return Organization.objects.filter(is_active=True).select_related(
        "industry", "country", "province", "city"
    )


def list_public_organizations(
    *,
    search: str | None = None,
    province: str | None = None,
    industry: str | None = None,
    organization_type: str | None = None,
    is_verified: bool | None = None,
) -> QuerySet[Organization]:
    queryset = _public()
    if search:
        queryset = queryset.filter(Q(name__icontains=search) | Q(english_name__icontains=search))
    if province:
        queryset = queryset.filter(province__slug=province)
    if industry:
        queryset = queryset.filter(industry__slug=industry)
    if organization_type:
        queryset = queryset.filter(organization_type=organization_type)
    if is_verified is not None:
        queryset = queryset.filter(is_verified=is_verified)
    return queryset


def get_public_organization(slug: str) -> Organization:
    return get_object_or_404(_public(), slug=slug)


def list_industries() -> QuerySet[Industry]:
    return Industry.objects.all()
