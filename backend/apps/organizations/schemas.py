from datetime import date
from uuid import UUID

from ninja import Schema

from apps.geography.schemas import CityRef, ProvinceRef
from apps.organizations.models import Organization, OrganizationType


class IndustryOut(Schema):
    slug: str
    name_fa: str
    name_en: str


class OrganizationFilters(Schema):
    search: str | None = None
    province: str | None = None
    city: str | None = None
    industry: str | None = None
    organization_type: OrganizationType | None = None
    is_verified: bool | None = None


class OrganizationListOut(Schema):
    id: UUID
    slug: str
    name: str
    english_name: str
    logo: str | None
    organization_type: OrganizationType
    organization_type_display: str
    industry: IndustryOut | None
    province: ProvinceRef | None
    city: CityRef | None
    is_verified: bool
    description: str

    @staticmethod
    def resolve_logo(obj: Organization) -> str | None:
        return obj.logo.url if obj.logo else None

    @staticmethod
    def resolve_organization_type_display(obj: Organization) -> str:
        return obj.get_organization_type_display()

    @staticmethod
    def resolve_description(obj: Organization) -> str:
        text = (obj.description or "").strip()
        return text[:220]


class OrganizationDetailOut(OrganizationListOut):
    cover_image: str | None
    established_at: date | None
    address: str
    postal_code: str
    phone: str
    mobile: str
    email: str
    website: str
    whatsapp: str
    telegram: str
    linkedin: str
    instagram: str

    @staticmethod
    def resolve_cover_image(obj: Organization) -> str | None:
        return obj.cover_image.url if obj.cover_image else None

    @staticmethod
    def resolve_description(obj: Organization) -> str:
        return (obj.description or "").strip()
