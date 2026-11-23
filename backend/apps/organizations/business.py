from __future__ import annotations

from typing import Any
from uuid import UUID

from django.contrib.contenttypes.models import ContentType
from django.core.cache import cache
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.files.uploadedfile import UploadedFile
from django.db import IntegrityError, transaction
from django.db.models import QuerySet
from django.utils import timezone

from apps.accounts.models import User
from apps.core.errors import ApiError
from apps.core.validators import validate_image_extension, validate_image_size
from apps.core.verification import USER_SUBMIT_STATES, VerificationStatus
from apps.geography.models import City, Country, Province
from apps.services.models import ProductInquiry, ProductListing, SellerProfile
from apps.trade.models import OpportunityReviewStatus, TradeOpportunity

from .access import (
    PROFILE_ROLES,
    PUBLISH_ROLES,
    VERIFICATION_ROLES,
    ActiveIdentity,
    require_org_role,
    sync_trade_members,
)
from .audit import audit
from .files import validate_private_document
from .models import (
    MEMBER_ADMIN_ROLES,
    BusinessAuditLog,
    DocumentType,
    InvitationStatus,
    MemberRole,
    MembershipStatus,
    Organization,
    OrganizationMember,
    OrganizationType,
    VerificationDocument,
)

_LEGAL_FIELDS = ("name", "national_id", "registration_number", "economic_code")
_MAX_DOCUMENTS = 10


def _location(province_id: int | None, city_id: int | None) -> tuple[Province | None, City | None]:
    if province_id is None:
        if city_id:
            raise ApiError("برای انتخاب شهر، استان را هم انتخاب کنید.")
        return None, None
    province = Province.objects.filter(pk=province_id, country__iso2="IR").first()
    if province is None:
        raise ApiError("استان انتخاب‌شده معتبر نیست.")
    city = None
    if city_id:
        city = City.objects.filter(pk=city_id, province=province).first()
        if city is None:
            raise ApiError("شهر انتخاب‌شده با استان انتخابی مطابقت ندارد.")
    return province, city


def _validation_message(exc: DjangoValidationError) -> str:
    if hasattr(exc, "message_dict"):
        return " ".join(
            f"{field}: {' '.join(messages)}" for field, messages in exc.message_dict.items()
        )
    return " ".join(exc.messages)


def list_identities(user: User, active: ActiveIdentity | None) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    seller = SellerProfile.objects.filter(user=user).first()
    if seller is not None:
        rows.append(
            {
                "kind": "individual",
                "id": str(seller.pk),
                "label": seller.display_name,
                "role": None,
                "verification_status": seller.verification_status,
                "is_active_context": bool(
                    active
                    and active.kind == "individual"
                    and active.seller
                    and active.seller.pk == seller.pk
                ),
            }
        )
    memberships = OrganizationMember.objects.select_related("organization").filter(
        user=user,
        status=MembershipStatus.ACTIVE,
    )
    for membership in memberships:
        org = membership.organization
        rows.append(
            {
                "kind": "organization",
                "id": str(org.pk),
                "label": org.name,
                "role": membership.role,
                "verification_status": org.verification_status,
                "is_active_context": bool(
                    active and active.kind == "organization" and active.organization
                    and active.organization.pk == org.pk
                ),
            }
        )
    return rows


def create_individual(user: User, data: dict[str, Any]) -> SellerProfile:
    if SellerProfile.objects.filter(user=user).exists():
        raise ApiError(
            "پروفایل فردی این حساب از قبل وجود دارد.",
            status_code=409,
            code="duplicate_profile",
        )
    province, city = _location(data.get("province_id"), data.get("city_id"))
    profile = SellerProfile(
        user=user,
        display_name=data["display_name"].strip(),
        professional_title=data.get("professional_title", "").strip(),
        bio=data.get("bio", "").strip(),
        public_phone=data.get("public_phone", "").strip(),
        public_email=data.get("public_email", "").strip(),
        province=province,
        city=city,
        is_public=True,
        verification_status=VerificationStatus.DRAFT,
    )
    try:
        profile.full_clean()
        profile.save()
    except DjangoValidationError as exc:
        raise ApiError(_validation_message(exc)) from exc
    audit(user, "individual.create", profile)
    return profile


def update_individual(user: User, data: dict[str, Any]) -> SellerProfile:
    profile = SellerProfile.objects.filter(user=user).first()
    if profile is None:
        raise ApiError("پروفایل فردی پیدا نشد.", status_code=404)
    suspended = profile.verification_status == VerificationStatus.SUSPENDED
    province, city = _location(data.get("province_id"), data.get("city_id"))
    profile.display_name = data["display_name"].strip()
    profile.professional_title = data.get("professional_title", "").strip()
    profile.bio = data.get("bio", "").strip()
    profile.public_phone = data.get("public_phone", "").strip()
    profile.public_email = data.get("public_email", "").strip()
    profile.province = province
    profile.city = city
    if suspended:
        profile.is_public = False
    else:
        profile.is_public = bool(data.get("is_public", True))
    try:
        profile.full_clean()
        profile.save()
    except DjangoValidationError as exc:
        raise ApiError(_validation_message(exc)) from exc
    audit(user, "individual.update", profile, suspended=suspended)
    return profile


def set_individual_image(user: User, slot: str, upload: UploadedFile) -> SellerProfile:
    fields = {"profile": "profile_image", "cover": "cover_image"}
    field_name = fields.get(slot)
    if field_name is None:
        raise ApiError("محل تصویر معتبر نیست.")
    profile = SellerProfile.objects.filter(user=user).first()
    if profile is None:
        raise ApiError("پروفایل فردی پیدا نشد.", status_code=404)
    _save_public_image(profile, field_name, upload)
    audit(user, "individual.image", profile, slot=slot)
    return profile


def _save_public_image(instance: Any, field_name: str, upload: UploadedFile) -> None:
    try:
        validate_image_extension(upload)
        validate_image_size(upload)
    except DjangoValidationError as exc:
        raise ApiError("تصویر باید JPG، PNG یا WebP و حداکثر ۲ مگابایت باشد.") from exc
    getattr(instance, field_name).save(upload.name, upload, save=False)
    instance.save(update_fields=[field_name, "updated_at"])


def submit_individual(user: User) -> SellerProfile:
    profile = SellerProfile.objects.filter(user=user).first()
    if profile is None:
        raise ApiError("پروفایل فردی پیدا نشد.", status_code=404)
    if profile.verification_status == VerificationStatus.SUSPENDED:
        raise ApiError("پروفایل تعلیق‌شده با ارسال مجدد فعال نمی‌شود.", status_code=403)
    if profile.verification_status == VerificationStatus.PENDING:
        return profile
    if profile.verification_status not in USER_SUBMIT_STATES | {VerificationStatus.VERIFIED}:
        raise ApiError("این پروفایل در وضعیت فعلی قابل ارسال نیست.")
    if len(profile.display_name.strip()) < 2:
        raise ApiError("نام نمایشی را کامل کنید.")
    profile.verification_status = VerificationStatus.PENDING
    profile.submitted_at = timezone.now()
    profile.rejection_reason = ""
    profile.reviewed_at = None
    profile.reviewed_by = None
    profile.save(
        update_fields=[
            "verification_status",
            "submitted_at",
            "rejection_reason",
            "reviewed_at",
            "reviewed_by",
            "updated_at",
        ]
    )
    audit(user, "individual.submit", profile)
    return profile


def _apply_org_flags(org: Organization) -> None:
    status = org.verification_status
    if status == VerificationStatus.VERIFIED:
        org.is_verified = True
        org.is_active = True
    elif status == VerificationStatus.SUSPENDED:
        org.is_verified = False
        org.is_active = False
    else:
        org.is_verified = False
        org.is_active = True


def create_organization(user: User, data: dict[str, Any]) -> Organization:
    hour_key = f"biz-org-create:{user.pk}"
    created = int(cache.get(hour_key, 0))
    if created >= 5:
        raise ApiError("تعداد ثبت شرکت در این ساعت زیاد است.", status_code=429, code="rate_limited")
    province, city = _location(data.get("province_id"), data.get("city_id"))
    org_type = data.get("organization_type") or OrganizationType.OTHER
    if org_type not in OrganizationType.values:
        raise ApiError("نوع شرکت معتبر نیست.")
    country = Country.objects.filter(iso2="IR").first()
    org = Organization(
        name=data["name"].strip(),
        english_name=data.get("english_name", "").strip(),
        organization_type=org_type,
        national_id=data.get("national_id", "").strip(),
        registration_number=data.get("registration_number", "").strip(),
        economic_code=data.get("economic_code", "").strip(),
        ceo_name=data.get("ceo_name", "").strip(),
        representative_name=data.get("representative_name", "").strip(),
        representative_phone=data.get("representative_phone", "").strip(),
        description=data.get("description", "").strip(),
        country=country,
        province=province,
        city=city,
        address=data.get("address", "").strip(),
        phone=data.get("phone", "").strip(),
        email=data.get("email", "").strip(),
        website=data.get("website", "").strip(),
        verification_status=VerificationStatus.DRAFT,
        is_verified=False,
        is_active=True,
    )
    try:
        with transaction.atomic():
            org.full_clean()
            org.save()
            OrganizationMember.objects.create(
                organization=org,
                user=user,
                role=MemberRole.OWNER,
                status=MembershipStatus.ACTIVE,
                invitation_status=InvitationStatus.ACCEPTED,
            )
            sync_trade_members(org)
    except DjangoValidationError as exc:
        raise ApiError(_validation_message(exc)) from exc
    except IntegrityError as exc:
        raise ApiError(
            "شناسه ثبتی واردشده قبلاً استفاده شده است.",
            status_code=409,
            code="duplicate_identifier",
        ) from exc
    cache.set(hour_key, created + 1, timeout=3600)
    audit(user, "organization.create", org)
    return org


def owned_organizations(user: User) -> QuerySet[Organization]:
    ids = OrganizationMember.objects.filter(
        user=user,
        status=MembershipStatus.ACTIVE,
    ).values_list("organization_id", flat=True)
    return Organization.objects.filter(pk__in=ids).select_related("province", "city")


def get_owned_organization(
    user: User,
    organization_id: UUID,
) -> tuple[Organization, OrganizationMember]:
    membership = (
        OrganizationMember.objects.select_related(
            "organization",
            "organization__province",
            "organization__city",
        )
        .filter(organization_id=organization_id, user=user, status=MembershipStatus.ACTIVE)
        .first()
    )
    if membership is None:
        raise ApiError("شرکت پیدا نشد.", status_code=404)
    return membership.organization, membership


def update_organization(user: User, organization_id: UUID, data: dict[str, Any]) -> Organization:
    org, membership = get_owned_organization(user, organization_id)
    if membership.role not in PROFILE_ROLES:
        raise ApiError("نقش شما اجازه ویرایش اطلاعات شرکت را نمی‌دهد.", status_code=403)
    suspended = org.verification_status == VerificationStatus.SUSPENDED
    previous = {field: getattr(org, field) for field in _LEGAL_FIELDS}
    province, city = _location(data.get("province_id"), data.get("city_id"))
    org_type = data.get("organization_type") or org.organization_type
    if org_type not in OrganizationType.values:
        raise ApiError("نوع شرکت معتبر نیست.")
    org.name = data["name"].strip()
    org.english_name = data.get("english_name", "").strip()
    org.organization_type = org_type
    org.national_id = data.get("national_id", "").strip()
    org.registration_number = data.get("registration_number", "").strip()
    org.economic_code = data.get("economic_code", "").strip()
    org.ceo_name = data.get("ceo_name", "").strip()
    org.representative_name = data.get("representative_name", "").strip()
    org.representative_phone = data.get("representative_phone", "").strip()
    org.description = data.get("description", "").strip()
    org.province = province
    org.city = city
    org.address = data.get("address", "").strip()
    org.phone = data.get("phone", "").strip()
    org.email = data.get("email", "").strip()
    org.website = data.get("website", "").strip()
    legal_changed = any(previous[field] != getattr(org, field) for field in _LEGAL_FIELDS)
    if suspended:
        pass
    elif legal_changed and org.verification_status == VerificationStatus.VERIFIED:
        org.verification_status = VerificationStatus.PENDING
        org.submitted_at = timezone.now()
        org.rejection_reason = ""
    _apply_org_flags(org)
    if suspended:
        org.verification_status = VerificationStatus.SUSPENDED
        org.is_verified = False
        org.is_active = False
    try:
        org.full_clean()
        org.save()
    except DjangoValidationError as exc:
        raise ApiError(_validation_message(exc)) from exc
    except IntegrityError as exc:
        raise ApiError(
            "شناسه ثبتی واردشده قبلاً استفاده شده است.",
            status_code=409,
            code="duplicate_identifier",
        ) from exc
    audit(user, "organization.update", org, legal_changed=legal_changed)
    return org


def set_organization_image(
    user: User,
    organization_id: UUID,
    slot: str,
    upload: UploadedFile,
) -> Organization:
    fields = {"logo": "logo", "cover": "cover_image"}
    field_name = fields.get(slot)
    if field_name is None:
        raise ApiError("محل تصویر معتبر نیست.")
    org, membership = get_owned_organization(user, organization_id)
    if membership.role not in PROFILE_ROLES:
        raise ApiError("نقش شما اجازه ویرایش تصاویر شرکت را نمی‌دهد.", status_code=403)
    _save_public_image(org, field_name, upload)
    audit(user, "organization.image", org, slot=slot)
    return org


def submit_organization(user: User, organization_id: UUID) -> Organization:
    org, membership = get_owned_organization(user, organization_id)
    if membership.role not in VERIFICATION_ROLES:
        raise ApiError("فقط مالک یا مدیر می‌تواند درخواست تأیید بفرستد.", status_code=403)
    if org.verification_status == VerificationStatus.SUSPENDED:
        raise ApiError("شرکت تعلیق‌شده با ارسال مجدد فعال نمی‌شود.", status_code=403)
    if org.verification_status == VerificationStatus.PENDING:
        return org
    if org.verification_status not in USER_SUBMIT_STATES | {VerificationStatus.VERIFIED}:
        raise ApiError("این شرکت در وضعیت فعلی قابل ارسال نیست.")
    has_contact = bool(org.phone or org.representative_phone)
    if not org.name.strip() or org.province_id is None or not has_contact:
        raise ApiError("نام، استان و یک شماره تماس را قبل از ارسال کامل کنید.")
    org.verification_status = VerificationStatus.PENDING
    org.submitted_at = timezone.now()
    org.rejection_reason = ""
    org.reviewed_at = None
    org.reviewed_by = None
    _apply_org_flags(org)
    org.save()
    audit(user, "organization.submit", org)
    return org


@transaction.atomic
def staff_decide_organization(
    reviewer: User,
    organization: Organization,
    status: str,
    reason: str = "",
) -> None:
    if not reviewer.has_perm("organizations.moderate_organization"):
        raise DjangoValidationError("مجوز بررسی شرکت را ندارید.")
    if status not in {
        VerificationStatus.VERIFIED,
        VerificationStatus.REJECTED,
        VerificationStatus.SUSPENDED,
    }:
        raise DjangoValidationError("وضعیت بررسی معتبر نیست.")
    if status == VerificationStatus.REJECTED and not reason.strip():
        raise DjangoValidationError("دلیل رد الزامی است.")
    organization.verification_status = status
    organization.rejection_reason = reason.strip() if status == VerificationStatus.REJECTED else ""
    organization.reviewed_at = timezone.now()
    organization.reviewed_by = reviewer
    _apply_org_flags(organization)
    organization.save()
    audit(reviewer, "organization.decision", organization, status=status)


@transaction.atomic
def staff_decide_individual(
    reviewer: User,
    profile: SellerProfile,
    status: str,
    reason: str = "",
) -> None:
    if not reviewer.has_perm("services.moderate_sellerprofile"):
        raise DjangoValidationError("مجوز بررسی پروفایل فردی را ندارید.")
    if status not in {
        VerificationStatus.VERIFIED,
        VerificationStatus.REJECTED,
        VerificationStatus.SUSPENDED,
    }:
        raise DjangoValidationError("وضعیت بررسی معتبر نیست.")
    if status == VerificationStatus.REJECTED and not reason.strip():
        raise DjangoValidationError("دلیل رد الزامی است.")
    profile.verification_status = status
    profile.rejection_reason = reason.strip() if status == VerificationStatus.REJECTED else ""
    profile.reviewed_at = timezone.now()
    profile.reviewed_by = reviewer
    if status == VerificationStatus.SUSPENDED:
        profile.is_public = False
    profile.save()
    audit(reviewer, "individual.decision", profile, status=status)


def _target_for_documents(user: User, kind: str, identity_id: str) -> tuple[Any, str]:
    if kind == "individual":
        profile = SellerProfile.objects.filter(user=user).first()
        if profile is None or (identity_id and identity_id != str(profile.pk)):
            raise ApiError("پروفایل فردی پیدا نشد.", status_code=404)
        return profile, str(profile.pk)
    if kind == "organization":
        org, membership = get_owned_organization(user, UUID(identity_id))
        if membership.role not in VERIFICATION_ROLES:
            raise ApiError("فقط مالک یا مدیر می‌تواند مدرک بارگذاری کند.", status_code=403)
        return org, str(org.pk)
    raise ApiError("نوع هویت معتبر نیست.")


def add_document(
    user: User,
    *,
    kind: str,
    identity_id: str,
    document_type: str,
    upload: UploadedFile,
) -> VerificationDocument:
    if document_type not in DocumentType.values:
        raise ApiError("نوع مدرک معتبر نیست.")
    try:
        target, object_id = _target_for_documents(user, kind, identity_id)
    except ValueError as exc:
        raise ApiError("شناسه شرکت معتبر نیست.") from exc
    content_type = ContentType.objects.get_for_model(target)
    existing = VerificationDocument.objects.filter(content_type=content_type, object_id=object_id)
    if existing.count() >= _MAX_DOCUMENTS:
        raise ApiError("برای هر هویت حداکثر 10 مدرک می‌توان بارگذاری کرد.")
    validate_private_document(upload)
    document = VerificationDocument(
        content_type=content_type,
        object_id=object_id,
        document_type=document_type,
        file=upload,
        uploaded_by=user,
    )
    document.save()
    audit(user, "document.upload", document, document_type=document_type)
    return document


def documents_for(user: User, kind: str, identity_id: str) -> QuerySet[VerificationDocument]:
    try:
        target, object_id = _target_for_documents(user, kind, identity_id)
    except ValueError as exc:
        raise ApiError("شناسه شرکت معتبر نیست.") from exc
    content_type = ContentType.objects.get_for_model(target)
    return VerificationDocument.objects.filter(content_type=content_type, object_id=object_id)


def document_for_user(user: User, document_id: int) -> VerificationDocument:
    document = VerificationDocument.objects.filter(pk=document_id).first()
    if document is None:
        raise ApiError("مدرک پیدا نشد.", status_code=404)
    if user.has_perm("organizations.view_verificationdocument") or user.has_perm(
        "organizations.moderate_organization"
    ):
        return document
    model = document.content_type.model_class()
    if model is SellerProfile:
        profile = SellerProfile.objects.filter(pk=document.object_id, user=user).first()
        if profile is None:
            raise ApiError("مدرک پیدا نشد.", status_code=404)
        return document
    if model is Organization:
        if not OrganizationMember.objects.filter(
            organization_id=document.object_id,
            user=user,
            status=MembershipStatus.ACTIVE,
        ).exists():
            raise ApiError("مدرک پیدا نشد.", status_code=404)
        return document
    raise ApiError("مدرک پیدا نشد.", status_code=404)


def _guard_membership_change(
    actor_role: str,
    membership: OrganizationMember,
    role: str,
    status: str,
) -> None:
    if actor_role not in MEMBER_ADMIN_ROLES:
        raise ApiError("اجازه مدیریت اعضا را ندارید.", status_code=403)
    if actor_role == MemberRole.ADMIN and (
        membership.role == MemberRole.OWNER or role == MemberRole.OWNER
    ):
        raise ApiError("مدیر نمی‌تواند نقش مالک را تغییر دهد.", status_code=403)
    demoting_owner = role != MemberRole.OWNER or status != MembershipStatus.ACTIVE
    if membership.role == MemberRole.OWNER and demoting_owner:
        others = (
            membership.organization.memberships.filter(
                role=MemberRole.OWNER,
                status=MembershipStatus.ACTIVE,
            )
            .exclude(pk=membership.pk)
            .count()
        )
        if others == 0:
            raise ApiError("آخرین مالک فعال را نمی‌توان حذف یا تغییر نقش داد.")


def invite_member(actor: User, organization_id: UUID, email: str, phone: str) -> None:
    org, membership = get_owned_organization(actor, organization_id)
    if org.verification_status == VerificationStatus.SUSPENDED or not org.is_active:
        raise ApiError("عضویت شرکت تعلیق‌شده قابل تغییر نیست.", status_code=403)
    if membership.role not in MEMBER_ADMIN_ROLES:
        raise ApiError("اجازه دعوت عضو را ندارید.", status_code=403)
    found = None
    if email.strip():
        found = User.objects.filter(email__iexact=email.strip().lower(), is_active=True).first()
    elif phone.strip():
        found = User.objects.filter(phone=phone.strip(), is_active=True).first()
    else:
        raise ApiError("ایمیل یا شماره تلفن عضو را وارد کنید.")
    if found is None or found.pk == actor.pk:
        return
    existing = OrganizationMember.objects.filter(organization=org, user=found).first()
    if existing and existing.status == MembershipStatus.ACTIVE:
        raise ApiError("این کاربر از قبل عضو شرکت است.", status_code=409)
    if existing:
        existing.role = MemberRole.MEMBER
        existing.status = MembershipStatus.INVITED
        existing.invitation_status = InvitationStatus.PENDING
        existing.save()
        target = existing
    else:
        target = OrganizationMember.objects.create(
            organization=org,
            user=found,
            role=MemberRole.MEMBER,
            status=MembershipStatus.INVITED,
            invitation_status=InvitationStatus.PENDING,
        )
    audit(actor, "membership.invite", target, role=target.role)


def update_member(
    actor: User,
    organization_id: UUID,
    member_id: UUID,
    role: str,
    status: str,
) -> OrganizationMember:
    org, actor_membership = get_owned_organization(actor, organization_id)
    if org.verification_status == VerificationStatus.SUSPENDED or not org.is_active:
        raise ApiError("عضویت شرکت تعلیق‌شده قابل تغییر نیست.", status_code=403)
    if role not in MemberRole.values or status not in MembershipStatus.values:
        raise ApiError("نقش یا وضعیت عضویت معتبر نیست.")
    membership = OrganizationMember.objects.filter(pk=member_id, organization=org).first()
    if membership is None:
        raise ApiError("عضو پیدا نشد.", status_code=404)
    _guard_membership_change(actor_membership.role, membership, role, status)
    membership.role = role
    membership.status = status
    if status == MembershipStatus.ACTIVE:
        membership.invitation_status = InvitationStatus.ACCEPTED
    elif status == MembershipStatus.REMOVED:
        membership.invitation_status = InvitationStatus.NONE
    membership.save()
    sync_trade_members(org)
    audit(actor, "membership.update", membership, role=role, status=status)
    return membership


def respond_invite(user: User, member_id: UUID, *, accept: bool) -> OrganizationMember:
    membership = (
        OrganizationMember.objects.select_related("organization")
        .filter(pk=member_id, user=user, invitation_status=InvitationStatus.PENDING)
        .first()
    )
    if membership is None:
        raise ApiError("دعوت پیدا نشد.", status_code=404)
    if membership.organization.verification_status == VerificationStatus.SUSPENDED:
        raise ApiError("این شرکت تعلیق شده است.", status_code=403)
    if accept:
        membership.status = MembershipStatus.ACTIVE
        membership.invitation_status = InvitationStatus.ACCEPTED
    else:
        membership.status = MembershipStatus.REMOVED
        membership.invitation_status = InvitationStatus.DECLINED
    membership.save()
    sync_trade_members(membership.organization)
    audit(user, "membership.accept" if accept else "membership.decline", membership)
    return membership


def dashboard(user: User, identity: ActiveIdentity | None) -> dict[str, Any]:
    if identity is None:
        return {
            "kind": "",
            "id": "",
            "label": "",
            "role": None,
            "verification_status": "",
            "rejection_reason": "",
            "can_publish": False,
            "can_edit_profile": False,
            "can_submit_verification": False,
            "can_manage_members": False,
            "can_manage_trade": False,
            "listings_total": 0,
            "inquiries_new": 0,
            "opportunities_total": 0,
        }
    if identity.organization is not None:
        org = identity.organization
        listings = ProductListing.objects.filter(organization=org)
        inquiries = ProductInquiry.objects.filter(
            listing__organization=org,
            status=ProductInquiry.Status.NEW,
        )
        opportunities = TradeOpportunity.objects.filter(company=org)
        role = identity.role or ""
        return {
            "kind": "organization",
            "id": str(org.pk),
            "label": org.name,
            "role": role,
            "verification_status": org.verification_status,
            "rejection_reason": org.rejection_reason,
            "can_publish": role in PUBLISH_ROLES
            and org.verification_status != VerificationStatus.SUSPENDED,
            "can_edit_profile": role in PROFILE_ROLES,
            "can_submit_verification": role in VERIFICATION_ROLES
            and org.verification_status != VerificationStatus.SUSPENDED,
            "can_manage_members": role in MEMBER_ADMIN_ROLES
            and org.verification_status != VerificationStatus.SUSPENDED,
            "can_manage_trade": role in PUBLISH_ROLES and org.is_active,
            "listings_total": listings.count(),
            "inquiries_new": inquiries.count(),
            "opportunities_total": opportunities.count(),
        }
    seller = identity.seller
    if seller is None:
        raise ApiError("پروفایل فردی پیدا نشد.", status_code=404)
    listings = ProductListing.objects.filter(seller=seller, organization__isnull=True)
    return {
        "kind": "individual",
        "id": str(seller.pk),
        "label": seller.display_name,
        "role": None,
        "verification_status": seller.verification_status,
        "rejection_reason": seller.rejection_reason,
        "can_publish": seller.verification_status != VerificationStatus.SUSPENDED,
        "can_edit_profile": True,
        "can_submit_verification": seller.verification_status != VerificationStatus.SUSPENDED,
        "can_manage_members": False,
        "can_manage_trade": False,
        "listings_total": listings.count(),
        "inquiries_new": ProductInquiry.objects.filter(
            listing__seller=seller,
            listing__organization__isnull=True,
            status=ProductInquiry.Status.NEW,
        ).count(),
        "opportunities_total": 0,
    }


def identity_listings(identity: ActiveIdentity, kind: str) -> QuerySet[ProductListing]:
    if kind and kind not in ProductListing.Kind.values:
        raise ApiError("نوع آگهی معتبر نیست.")
    if identity.organization is not None:
        queryset = ProductListing.objects.filter(organization=identity.organization)
    elif identity.seller is not None:
        queryset = ProductListing.objects.filter(seller=identity.seller, organization__isnull=True)
    else:
        queryset = ProductListing.objects.none()
    if kind:
        queryset = queryset.filter(listing_kind=kind)
    return queryset.order_by("-updated_at")


def _opportunity_message(exc: DjangoValidationError) -> str:
    return _validation_message(exc)


def create_opportunity(user: User, organization_id: UUID, data: dict[str, Any]) -> TradeOpportunity:
    org, membership = get_owned_organization(user, organization_id)
    if membership.role not in PUBLISH_ROLES:
        raise ApiError("نقش شما اجازه ثبت فرصت تجاری را نمی‌دهد.", status_code=403)
    if org.verification_status == VerificationStatus.SUSPENDED or not org.is_active:
        raise ApiError("شرکت تعلیق‌شده نمی‌تواند فرصت تجاری ثبت کند.", status_code=403)
    province = Province.objects.filter(
        pk=data["province_id"],
        country__iso2="IR",
        is_published=True,
    ).first()
    if province is None:
        raise ApiError("استان انتخاب‌شده معتبر نیست.")
    city = None
    if data.get("city_id"):
        city = City.objects.filter(pk=data["city_id"], province=province).first()
        if city is None:
            raise ApiError("شهر انتخاب‌شده با استان انتخابی مطابقت ندارد.")
    opportunity = TradeOpportunity(
        title=data["title"].strip(),
        province=province,
        city=city,
        opportunity_type=data["opportunity_type"],
        description=data["description"].strip(),
        target_market=data.get("target_market", "").strip(),
        company=org,
        source=data.get("source", "").strip() or "ثبت‌شده توسط شرکت در کارفنسا",
        valid_until=data.get("valid_until"),
        created_by=user,
        review_status=OpportunityReviewStatus.PENDING,
        is_published=False,
    )
    try:
        opportunity.full_clean()
        opportunity.save()
    except DjangoValidationError as exc:
        raise ApiError(_opportunity_message(exc)) from exc
    audit(user, "trade.create", opportunity)
    return opportunity


def company_opportunities(user: User, organization_id: UUID) -> QuerySet[TradeOpportunity]:
    org, _membership = get_owned_organization(user, organization_id)
    require_org_role(user, org, PUBLISH_ROLES | {"member"})
    return (
        TradeOpportunity.objects.filter(company=org)
        .select_related("province", "city")
        .order_by("-created_at")
    )


def _editable_opportunity(user: User, opportunity_id: int) -> TradeOpportunity:
    opportunity = (
        TradeOpportunity.objects.select_related("company")
        .filter(pk=opportunity_id, company__isnull=False)
        .first()
    )
    if opportunity is None or opportunity.company is None:
        raise ApiError("فرصت تجاری پیدا نشد.", status_code=404)
    require_org_role(user, opportunity.company, PUBLISH_ROLES)
    if opportunity.is_published:
        raise ApiError("فرصت منتشرشده را از این مسیر نمی‌توان تغییر داد.", status_code=403)
    return opportunity


def update_opportunity(user: User, opportunity_id: int, data: dict[str, Any]) -> TradeOpportunity:
    opportunity = _editable_opportunity(user, opportunity_id)
    opportunity.title = data["title"].strip()
    opportunity.description = data["description"].strip()
    opportunity.opportunity_type = data["opportunity_type"]
    opportunity.review_status = OpportunityReviewStatus.PENDING
    opportunity.rejection_reason = ""
    try:
        opportunity.full_clean()
        opportunity.save()
    except DjangoValidationError as exc:
        raise ApiError(_validation_message(exc)) from exc
    audit(user, "trade.update", opportunity)
    return opportunity


def delete_opportunity(user: User, opportunity_id: int) -> None:
    opportunity = _editable_opportunity(user, opportunity_id)
    audit(user, "trade.delete", opportunity)
    opportunity.delete()


def recent_audit(target: Any, limit: int = 20) -> QuerySet[BusinessAuditLog]:
    return BusinessAuditLog.objects.filter(
        target_type=target._meta.label,
        target_id=str(target.pk),
    )[:limit]
