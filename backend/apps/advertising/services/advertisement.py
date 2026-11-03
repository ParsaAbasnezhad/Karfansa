from apps.advertising.models import Advertisement, AdvertisementStatus
from apps.core.workflow import ensure_transition

ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    AdvertisementStatus.DRAFT: {
        AdvertisementStatus.PENDING,
        AdvertisementStatus.PUBLISHED,  # staff publishing on behalf of a company
        AdvertisementStatus.ARCHIVED,
    },
    AdvertisementStatus.PENDING: {
        AdvertisementStatus.PUBLISHED,
        AdvertisementStatus.REJECTED,
        AdvertisementStatus.DRAFT,
    },
    AdvertisementStatus.PUBLISHED: {AdvertisementStatus.ARCHIVED},
    AdvertisementStatus.REJECTED: {AdvertisementStatus.DRAFT, AdvertisementStatus.ARCHIVED},
    AdvertisementStatus.ARCHIVED: {AdvertisementStatus.DRAFT},
}


def move_to(advertisement: Advertisement, target: AdvertisementStatus) -> None:
    ensure_transition(current=advertisement.status, target=target, allowed=ALLOWED_TRANSITIONS)
    advertisement.status = target


def submit_for_review(advertisement: Advertisement) -> Advertisement:
    move_to(advertisement, AdvertisementStatus.PENDING)
    advertisement.rejection_reason = ""
    advertisement.save(update_fields=["status", "rejection_reason", "updated_at"])
    return advertisement


def archive(advertisement: Advertisement) -> Advertisement:
    move_to(advertisement, AdvertisementStatus.ARCHIVED)
    advertisement.save(update_fields=["status", "updated_at"])
    return advertisement


def return_to_draft(advertisement: Advertisement) -> Advertisement:
    move_to(advertisement, AdvertisementStatus.DRAFT)
    advertisement.save(update_fields=["status", "updated_at"])
    return advertisement
