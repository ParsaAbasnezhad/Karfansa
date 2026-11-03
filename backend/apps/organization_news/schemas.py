from datetime import datetime
from uuid import UUID

from ninja import Schema

from apps.organization_news.models import OrganizationNews
from apps.organizations.models import Organization


class NewsFilters(Schema):
    organization: str | None = None
    search: str | None = None


class NewsOrganizationRef(Schema):
    slug: str
    name: str
    logo: str | None
    is_verified: bool

    @staticmethod
    def resolve_logo(obj: Organization) -> str | None:
        return obj.logo.url if obj.logo else None


class NewsListOut(Schema):
    id: UUID
    slug: str
    title: str
    summary: str
    image: str | None
    published_at: datetime
    organization: NewsOrganizationRef

    @staticmethod
    def resolve_image(obj: OrganizationNews) -> str | None:
        return obj.image.url if obj.image else None


class NewsDetailOut(NewsListOut):
    content: str
    source_url: str
