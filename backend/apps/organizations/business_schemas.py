from datetime import date, datetime
from uuid import UUID

from ninja import Schema
from pydantic import Field


class IdentityOut(Schema):
    kind: str
    id: str
    label: str
    role: str | None
    verification_status: str
    is_active_context: bool


class IdentitiesOut(Schema):
    identities: list[IdentityOut]
    active: IdentityOut | None


class SwitchIn(Schema):
    kind: str
    id: str = ""


class IndividualIn(Schema):
    display_name: str = Field(min_length=2, max_length=120)
    professional_title: str = Field(default="", max_length=120)
    bio: str = Field(default="", max_length=1500)
    province_id: int | None = None
    city_id: int | None = None
    public_phone: str = Field(default="", max_length=20)
    public_email: str = ""
    is_public: bool = True


class IndividualOut(Schema):
    id: int
    display_name: str
    professional_title: str
    bio: str
    province_id: int | None
    city_id: int | None
    province_name: str | None
    city_name: str | None
    public_phone: str
    public_email: str
    is_public: bool
    verification_status: str
    rejection_reason: str


class OrganizationIn(Schema):
    name: str = Field(min_length=2, max_length=200)
    english_name: str = ""
    organization_type: str = "other"
    national_id: str = ""
    registration_number: str = ""
    economic_code: str = ""
    ceo_name: str = ""
    representative_name: str = ""
    representative_phone: str = ""
    description: str = ""
    province_id: int | None = None
    city_id: int | None = None
    address: str = ""
    phone: str = ""
    email: str = ""
    website: str = ""


class OrganizationOut(Schema):
    id: UUID
    name: str
    slug: str
    organization_type: str
    national_id: str
    registration_number: str
    economic_code: str
    ceo_name: str
    representative_name: str
    representative_phone: str
    description: str
    province_id: int | None
    city_id: int | None
    province_name: str | None
    city_name: str | None
    address: str
    phone: str
    email: str
    website: str
    verification_status: str
    rejection_reason: str
    is_verified: bool
    is_active: bool
    role: str | None = None


class DocumentOut(Schema):
    id: int
    document_type: str
    review_status: str
    rejection_reason: str
    created_at: datetime


class MemberOut(Schema):
    id: UUID
    user_id: int
    display_name: str
    role: str
    status: str
    invitation_status: str
    created_at: datetime


class InviteIn(Schema):
    email: str = ""
    phone: str = ""


class MemberUpdateIn(Schema):
    role: str
    status: str


class DashboardOut(Schema):
    kind: str
    id: str
    label: str
    role: str | None
    verification_status: str
    rejection_reason: str
    can_publish: bool
    can_edit_profile: bool
    can_submit_verification: bool
    can_manage_members: bool
    can_manage_trade: bool
    listings_total: int
    inquiries_new: int
    opportunities_total: int


class OpportunityIn(Schema):
    title: str = Field(min_length=3, max_length=250)
    province_id: int
    city_id: int | None = None
    opportunity_type: str
    description: str = Field(min_length=10)
    target_market: str = ""
    source: str = ""
    valid_until: date | None = None


class OpportunityUpdateIn(Schema):
    title: str = Field(min_length=3, max_length=250)
    opportunity_type: str
    description: str = Field(min_length=10)


class OpportunityOut(Schema):
    id: int
    title: str
    slug: str
    opportunity_type: str
    description: str
    review_status: str
    rejection_reason: str
    is_published: bool
    province_name: str
    valid_until: date | None


class MessageOut(Schema):
    message: str
