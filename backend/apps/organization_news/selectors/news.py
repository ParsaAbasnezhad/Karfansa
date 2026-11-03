from django.db.models import Q, QuerySet
from django.shortcuts import get_object_or_404
from django.utils import timezone

from apps.organization_news.models import NewsStatus, OrganizationNews


def _published() -> QuerySet[OrganizationNews]:
    """Only published news of active companies, never future-dated."""
    return OrganizationNews.objects.filter(
        status=NewsStatus.PUBLISHED,
        published_at__lte=timezone.now(),
        organization__is_active=True,
    ).select_related("organization")


def list_published_news(
    *, organization: str | None = None, search: str | None = None
) -> QuerySet[OrganizationNews]:
    queryset = _published()
    if organization:
        queryset = queryset.filter(organization__slug=organization)
    if search:
        queryset = queryset.filter(Q(title__icontains=search) | Q(summary__icontains=search))
    return queryset


def get_published_news(*, organization_slug: str, slug: str) -> OrganizationNews:
    return get_object_or_404(_published(), organization__slug=organization_slug, slug=slug)
