from uuid import UUID

from django.http import FileResponse, HttpRequest
from django.views.decorators.csrf import csrf_protect
from ninja import File, Form, Router, UploadedFile
from ninja.decorators import decorate_view

from apps.organizations import business
from apps.organizations.access import identity_or_default, require_user, switch_identity
from apps.organizations.audit import audit
from apps.organizations.business_schemas import (
    DashboardOut,
    DocumentOut,
    IdentitiesOut,
    IdentityOut,
    IndividualIn,
    IndividualOut,
    InviteIn,
    MemberOut,
    MemberUpdateIn,
    MessageOut,
    OpportunityIn,
    OpportunityOut,
    OpportunityUpdateIn,
    OrganizationIn,
    OrganizationOut,
    SwitchIn,
)
from apps.organizations.models import Organization, OrganizationMember
from apps.services.models import SellerProfile
from apps.trade.models import TradeOpportunity

router = Router()


def _identity_out(row: dict[str, object]) -> IdentityOut:
    return IdentityOut.model_validate(row)


def _individual_out(profile: SellerProfile) -> IndividualOut:
    return IndividualOut(
        id=profile.pk,
        display_name=profile.display_name,
        professional_title=profile.professional_title,
        bio=profile.bio,
        province_id=profile.province_id,
        city_id=profile.city_id,
        province_name=profile.province.name_fa if profile.province_id else None,
        city_name=profile.city.name_fa if profile.city_id else None,
        public_phone=profile.public_phone,
        public_email=profile.public_email,
        is_public=profile.is_public,
        verification_status=profile.verification_status,
        rejection_reason=profile.rejection_reason,
    )


def _organization_out(org: Organization, role: str | None = None) -> OrganizationOut:
    return OrganizationOut(
        id=org.pk,
        name=org.name,
        slug=org.slug,
        organization_type=org.organization_type,
        national_id=org.national_id,
        registration_number=org.registration_number,
        economic_code=org.economic_code,
        ceo_name=org.ceo_name,
        representative_name=org.representative_name,
        representative_phone=org.representative_phone,
        description=org.description,
        province_id=org.province_id,
        city_id=org.city_id,
        province_name=org.province.name_fa if org.province_id else None,
        city_name=org.city.name_fa if org.city_id else None,
        address=org.address,
        phone=org.phone,
        email=org.email,
        website=org.website,
        verification_status=org.verification_status,
        rejection_reason=org.rejection_reason,
        is_verified=org.is_verified,
        is_active=org.is_active,
        role=role,
    )


def _member_out(membership: OrganizationMember) -> MemberOut:
    user = membership.user
    name = f"{user.first_name} {user.last_name}".strip() or user.email
    return MemberOut(
        id=membership.pk,
        user_id=user.pk,
        display_name=name,
        role=membership.role,
        status=membership.status,
        invitation_status=membership.invitation_status,
        created_at=membership.created_at,
    )


def _opportunity_out(item: TradeOpportunity) -> OpportunityOut:
    return OpportunityOut(
        id=item.pk,
        title=item.title,
        slug=item.slug,
        opportunity_type=item.opportunity_type,
        description=item.description,
        review_status=item.review_status,
        rejection_reason=item.rejection_reason,
        is_published=item.is_published,
        province_name=item.province.name_fa,
        valid_until=item.valid_until,
    )


@router.get("/identities", response=IdentitiesOut)
def identities(request: HttpRequest) -> IdentitiesOut:
    user = require_user(request)
    active = identity_or_default(request, user)
    rows = business.list_identities(user, active)
    active_row = next((row for row in rows if row["is_active_context"]), None)
    return IdentitiesOut(
        identities=[_identity_out(row) for row in rows],
        active=_identity_out(active_row) if active_row else None,
    )


@router.post("/identity", response=IdentityOut)
@decorate_view(csrf_protect)
def activate_identity(request: HttpRequest, payload: SwitchIn) -> IdentityOut:
    user = require_user(request)
    active = switch_identity(request, user, payload.kind, payload.id)
    audit(user, "identity.switch", active.organization or active.seller or user, kind=active.kind)
    rows = business.list_identities(user, active)
    current = next(row for row in rows if row["is_active_context"])
    return _identity_out(current)


@router.get("/dashboard", response=DashboardOut)
def business_dashboard(request: HttpRequest) -> DashboardOut:
    user = require_user(request)
    active = identity_or_default(request, user)
    return DashboardOut.model_validate(business.dashboard(user, active))


@router.post("/individual", response={201: IndividualOut})
@decorate_view(csrf_protect)
def create_individual_profile(
    request: HttpRequest,
    payload: IndividualIn,
) -> tuple[int, IndividualOut]:
    user = require_user(request)
    profile = business.create_individual(user, payload.dict())
    switch_identity(request, user, "individual", str(profile.pk))
    return 201, _individual_out(profile)


@router.get("/individual", response=IndividualOut)
def individual_profile(request: HttpRequest) -> IndividualOut:
    from apps.core.errors import ApiError

    user = require_user(request)
    profile = (
        SellerProfile.objects.select_related("province", "city").filter(user=user).first()
    )
    if profile is None:
        raise ApiError("پروفایل فردی پیدا نشد.", status_code=404)
    return _individual_out(profile)


@router.patch("/individual", response=IndividualOut)
@decorate_view(csrf_protect)
def patch_individual(request: HttpRequest, payload: IndividualIn) -> IndividualOut:
    user = require_user(request)
    profile = business.update_individual(user, payload.dict())
    return _individual_out(
        type(profile).objects.select_related("province", "city").get(pk=profile.pk)
    )


@router.post("/individual/image", response=IndividualOut)
@decorate_view(csrf_protect)
def upload_individual_image(
    request: HttpRequest,
    slot: str = Form(...),
    upload: UploadedFile = File(...),  # noqa: B008
) -> IndividualOut:
    user = require_user(request)
    profile = business.set_individual_image(user, slot, upload)
    return _individual_out(
        type(profile).objects.select_related("province", "city").get(pk=profile.pk)
    )


@router.post("/individual/submit", response=IndividualOut)
@decorate_view(csrf_protect)
def submit_individual_profile(request: HttpRequest) -> IndividualOut:
    user = require_user(request)
    profile = business.submit_individual(user)
    return _individual_out(profile)


@router.post("/organizations", response={201: OrganizationOut})
@decorate_view(csrf_protect)
def create_company(request: HttpRequest, payload: OrganizationIn) -> tuple[int, OrganizationOut]:
    user = require_user(request)
    org = business.create_organization(user, payload.dict())
    switch_identity(request, user, "organization", str(org.pk))
    return 201, _organization_out(org, role="owner")


@router.get("/organizations", response=list[OrganizationOut])
def my_companies(request: HttpRequest) -> list[OrganizationOut]:
    user = require_user(request)
    rows = []
    memberships = OrganizationMember.objects.select_related(
        "organization", "organization__province", "organization__city"
    ).filter(user=user, status="active")
    for membership in memberships:
        rows.append(_organization_out(membership.organization, role=membership.role))
    return rows


@router.get("/organizations/{organization_id}", response=OrganizationOut)
def company_detail(request: HttpRequest, organization_id: UUID) -> OrganizationOut:
    user = require_user(request)
    org, membership = business.get_owned_organization(user, organization_id)
    return _organization_out(org, role=membership.role)


@router.patch("/organizations/{organization_id}", response=OrganizationOut)
@decorate_view(csrf_protect)
def patch_company(
    request: HttpRequest,
    organization_id: UUID,
    payload: OrganizationIn,
) -> OrganizationOut:
    user = require_user(request)
    org = business.update_organization(user, organization_id, payload.dict())
    _org, membership = business.get_owned_organization(user, organization_id)
    return _organization_out(org, role=membership.role)


@router.post("/organizations/{organization_id}/image", response=OrganizationOut)
@decorate_view(csrf_protect)
def upload_company_image(
    request: HttpRequest,
    organization_id: UUID,
    slot: str = Form(...),
    upload: UploadedFile = File(...),  # noqa: B008
) -> OrganizationOut:
    user = require_user(request)
    org = business.set_organization_image(user, organization_id, slot, upload)
    _org, membership = business.get_owned_organization(user, organization_id)
    return _organization_out(org, role=membership.role)


@router.post("/organizations/{organization_id}/submit", response=OrganizationOut)
@decorate_view(csrf_protect)
def submit_company(request: HttpRequest, organization_id: UUID) -> OrganizationOut:
    user = require_user(request)
    org = business.submit_organization(user, organization_id)
    _org, membership = business.get_owned_organization(user, organization_id)
    return _organization_out(org, role=membership.role)


@router.post("/documents", response={201: DocumentOut})
@decorate_view(csrf_protect)
def upload_document(
    request: HttpRequest,
    kind: str = Form(...),
    identity_id: str = Form(""),
    document_type: str = Form(...),
    upload: UploadedFile = File(...),  # noqa: B008
) -> tuple[int, DocumentOut]:
    user = require_user(request)
    document = business.add_document(
        user,
        kind=kind,
        identity_id=identity_id,
        document_type=document_type,
        upload=upload,
    )
    return 201, DocumentOut(
        id=document.pk,
        document_type=document.document_type,
        review_status=document.review_status,
        rejection_reason=document.rejection_reason,
        created_at=document.created_at,
    )


@router.get("/documents", response=list[DocumentOut])
def list_documents(request: HttpRequest, kind: str, identity_id: str = "") -> list[DocumentOut]:
    user = require_user(request)
    return [
        DocumentOut(
            id=item.pk,
            document_type=item.document_type,
            review_status=item.review_status,
            rejection_reason=item.rejection_reason,
            created_at=item.created_at,
        )
        for item in business.documents_for(user, kind, identity_id)
    ]


@router.get("/documents/{document_id}/file")
def download_document(request: HttpRequest, document_id: int) -> FileResponse:
    user = require_user(request)
    document = business.document_for_user(user, document_id)
    filename = document.file.name.split("/")[-1]
    return FileResponse(document.file.open("rb"), as_attachment=True, filename=filename)


@router.get("/organizations/{organization_id}/members", response=list[MemberOut])
def company_members(request: HttpRequest, organization_id: UUID) -> list[MemberOut]:
    user = require_user(request)
    org, _membership = business.get_owned_organization(user, organization_id)
    memberships = org.memberships.select_related("user").order_by("created_at")
    return [_member_out(item) for item in memberships]


@router.post("/organizations/{organization_id}/members", response=MessageOut)
@decorate_view(csrf_protect)
def invite_company_member(
    request: HttpRequest,
    organization_id: UUID,
    payload: InviteIn,
) -> MessageOut:
    user = require_user(request)
    business.invite_member(user, organization_id, payload.email, payload.phone)
    return MessageOut(message="اگر حساب فعالی با این مشخصات وجود داشته باشد، دعوت ثبت می‌شود.")


@router.patch("/organizations/{organization_id}/members/{member_id}", response=MemberOut)
@decorate_view(csrf_protect)
def change_member(
    request: HttpRequest,
    organization_id: UUID,
    member_id: UUID,
    payload: MemberUpdateIn,
) -> MemberOut:
    user = require_user(request)
    membership = business.update_member(
        user,
        organization_id,
        member_id,
        payload.role,
        payload.status,
    )
    return _member_out(membership)


@router.post("/memberships/{member_id}/accept", response=MemberOut)
@decorate_view(csrf_protect)
def accept_membership(request: HttpRequest, member_id: UUID) -> MemberOut:
    user = require_user(request)
    return _member_out(business.respond_invite(user, member_id, accept=True))


@router.post("/memberships/{member_id}/decline", response=MemberOut)
@decorate_view(csrf_protect)
def decline_membership(request: HttpRequest, member_id: UUID) -> MemberOut:
    user = require_user(request)
    return _member_out(business.respond_invite(user, member_id, accept=False))


@router.get("/listings")
def owned_listings(
    request: HttpRequest,
    kind: str = "",
    page: int = 1,
    page_size: int = 20,
) -> dict[str, object]:
    from apps.services.api import _listing_data, _listing_queryset

    user = require_user(request)
    active = identity_or_default(request, user)
    if active is None:
        return {"results": [], "count": 0, "page": page, "page_size": page_size}
    page = max(page, 1)
    page_size = min(max(page_size, 1), 50)
    owned_ids = business.identity_listings(active, kind).values("pk")
    queryset = _listing_queryset().filter(pk__in=owned_ids)
    count = queryset.count()
    start = (page - 1) * page_size
    return {
        "results": [
            _listing_data(item).model_dump() for item in queryset[start : start + page_size]
        ],
        "count": count,
        "page": page,
        "page_size": page_size,
    }


@router.get("/organizations/{organization_id}/opportunities", response=list[OpportunityOut])
def list_company_opportunities(request: HttpRequest, organization_id: UUID) -> list[OpportunityOut]:
    user = require_user(request)
    items = business.company_opportunities(user, organization_id)
    return [_opportunity_out(item) for item in items]


@router.post("/organizations/{organization_id}/opportunities", response={201: OpportunityOut})
@decorate_view(csrf_protect)
def submit_company_opportunity(
    request: HttpRequest,
    organization_id: UUID,
    payload: OpportunityIn,
) -> tuple[int, OpportunityOut]:
    user = require_user(request)
    item = business.create_opportunity(user, organization_id, payload.dict())
    return 201, _opportunity_out(item)


@router.patch("/opportunities/{opportunity_id}", response=OpportunityOut)
@decorate_view(csrf_protect)
def edit_company_opportunity(
    request: HttpRequest,
    opportunity_id: int,
    payload: OpportunityUpdateIn,
) -> OpportunityOut:
    user = require_user(request)
    item = business.update_opportunity(user, opportunity_id, payload.dict())
    return _opportunity_out(item)


@router.delete("/opportunities/{opportunity_id}", response=MessageOut)
@decorate_view(csrf_protect)
def remove_company_opportunity(request: HttpRequest, opportunity_id: int) -> MessageOut:
    user = require_user(request)
    business.delete_opportunity(user, opportunity_id)
    return MessageOut(message="فرصت منتشرنشده حذف شد.")
