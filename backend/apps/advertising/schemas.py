from datetime import datetime
from uuid import UUID

from ninja import Schema

from apps.advertising.models import Advertisement
from apps.organizations.models import Organization


class AdvertiserRef(Schema):
    slug: str
    name: str
    is_verified: bool


class AdvertisementOut(Schema):
    id: UUID
    slug: str
    title: str
    description: str
    image: str | None
    target_url: str
    start_at: datetime | None
    end_at: datetime | None
    organization: AdvertiserRef

    @staticmethod
    def resolve_image(obj: Advertisement) -> str | None:
        return obj.image.url if obj.image else None

    @staticmethod
    def resolve_organization(obj: Advertisement) -> Organization:
        return obj.organization
