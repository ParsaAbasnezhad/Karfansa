from datetime import datetime

from django.db.models import Q, QuerySet
from django.utils import timezone

from apps.advertising.models import Advertisement, AdvertisementStatus


def list_active_advertisements(*, now: datetime | None = None) -> QuerySet[Advertisement]:
    """Ads that may be shown right now: published, inside their window, company active."""
    moment = now or timezone.now()
    return (
        Advertisement.objects.filter(
            status=AdvertisementStatus.PUBLISHED,
            organization__is_active=True,
        )
        .filter(Q(start_at__isnull=True) | Q(start_at__lte=moment))
        .filter(Q(end_at__isnull=True) | Q(end_at__gt=moment))
        .select_related("organization")
    )
