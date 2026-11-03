"""Staff decisions on an ad: approve (publish) or reject with a mandatory reason."""

from datetime import datetime
from http import HTTPStatus

from django.utils import timezone

from apps.advertising.models import Advertisement, AdvertisementStatus
from apps.advertising.services.advertisement import move_to
from apps.core.errors import ApiError


def approve(advertisement: Advertisement, *, now: datetime | None = None) -> Advertisement:
    move_to(advertisement, AdvertisementStatus.PUBLISHED)
    advertisement.published_at = advertisement.published_at or now or timezone.now()
    advertisement.rejection_reason = ""
    advertisement.save(update_fields=["status", "published_at", "rejection_reason", "updated_at"])
    return advertisement


def reject(advertisement: Advertisement, *, reason: str) -> Advertisement:
    reason = reason.strip()
    if not reason:
        raise ApiError(
            "A rejection reason is required.",
            status_code=HTTPStatus.UNPROCESSABLE_ENTITY,
            code="rejection_reason_required",
        )
    move_to(advertisement, AdvertisementStatus.REJECTED)
    advertisement.rejection_reason = reason
    advertisement.save(update_fields=["status", "rejection_reason", "updated_at"])
    return advertisement
