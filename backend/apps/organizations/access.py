"""Server-side business identity. Client-supplied company ids are never trusted."""

from dataclasses import dataclass
from typing import Literal

from django.http import HttpRequest

from apps.accounts.models import User
from apps.core.errors import ApiError
from apps.core.verification import VerificationStatus
from apps.services.models import ProductListing, SellerProfile

from .models import (
    INQUIRY_ROLES,
    PROFILE_ROLES,
    PUBLISH_ROLES,
    VERIFICATION_ROLES,
    MembershipStatus,
    Organization,
    OrganizationMember,
)

SESSION_KEY = "karfansa_business_identity"
IdentityKind = Literal["individual", "organization"]


@dataclass
class ActiveIdentity:
    kind: IdentityKind
    user: User
    seller: SellerProfile | None
    organization: Organization | None
    role: str | None

    @property
    def label(self) -> str:
        if self.organization is not None:
            return self.organization.name
        if self.seller is not None:
            return self.seller.display_name
        return "حساب کاربری"

    @property
    def reference(self) -> str:
        if self.organization is not None:
            return str(self.organization.pk)
        if self.seller is not None:
            return str(self.seller.pk)
        return ""

    @property
    def verification_status(self) -> str:
        if self.organization is not None:
            return self.organization.verification_status
        if self.seller is not None:
            return self.seller.verification_status
        return VerificationStatus.DRAFT


def require_user(request: HttpRequest) -> User:
    if not request.user.is_authenticated or not isinstance(request.user, User):
        raise ApiError("برای ادامه وارد حساب کاربری شوید.", status_code=401)
    return request.user


def _seller_for(user: User) -> SellerProfile | None:
    return SellerProfile.objects.filter(user=user).first()


def load_active_identity(request: HttpRequest, user: User) -> ActiveIdentity | None:
    raw = request.session.get(SESSION_KEY)
    if not isinstance(raw, dict):
        return None
    kind = raw.get("kind")
    if kind == "individual":
        seller = _seller_for(user)
        if seller is None:
            return None
        return ActiveIdentity("individual", user, seller, None, None)
    if kind == "organization":
        membership = (
            OrganizationMember.objects.select_related("organization")
            .filter(
                organization_id=raw.get("id"),
                user=user,
                status=MembershipStatus.ACTIVE,
            )
            .first()
        )
        if membership is None:
            return None
        return ActiveIdentity(
            "organization",
            user,
            None,
            membership.organization,
            membership.role,
        )
    return None


def identity_or_default(request: HttpRequest, user: User) -> ActiveIdentity | None:
    raw = request.session.get(SESSION_KEY)
    active = load_active_identity(request, user)
    if isinstance(raw, dict) and active is None:
        raise ApiError(
            "هویت فعال معتبر نیست. از داشبورد هویت دیگری انتخاب کنید.",
            status_code=403,
        )
    if active is not None:
        return active
    seller = _seller_for(user)
    if seller is None:
        return None
    return ActiveIdentity("individual", user, seller, None, None)


def switch_identity(
    request: HttpRequest,
    user: User,
    kind: str,
    identity_id: str,
) -> ActiveIdentity:
    if kind == "individual":
        seller = _seller_for(user)
        if seller is None or (identity_id and identity_id != str(seller.pk)):
            raise ApiError("پروفایل فردی فعالی برای این حساب پیدا نشد.", status_code=404)
        request.session[SESSION_KEY] = {"kind": "individual", "id": str(seller.pk)}
        request.session.modified = True
        return ActiveIdentity("individual", user, seller, None, None)
    if kind == "organization":
        membership = (
            OrganizationMember.objects.select_related("organization")
            .filter(organization_id=identity_id, user=user, status=MembershipStatus.ACTIVE)
            .first()
        )
        if membership is None:
            raise ApiError("عضویت فعالی در این شرکت ندارید.", status_code=403)
        request.session[SESSION_KEY] = {
            "kind": "organization",
            "id": str(membership.organization_id),
        }
        request.session.modified = True
        return ActiveIdentity(
            "organization",
            user,
            None,
            membership.organization,
            membership.role,
        )
    raise ApiError("نوع هویت معتبر نیست.")


def require_org_role(
    user: User,
    organization: Organization,
    roles: frozenset[str],
) -> OrganizationMember:
    membership = OrganizationMember.objects.filter(
        organization=organization,
        user=user,
        status=MembershipStatus.ACTIVE,
        role__in=roles,
    ).first()
    if membership is None:
        raise ApiError("اجازه این عملیات را در شرکت انتخاب‌شده ندارید.", status_code=403)
    return membership


def assert_not_suspended(identity: ActiveIdentity, *, publishing: bool) -> None:
    status = identity.verification_status
    if status == VerificationStatus.SUSPENDED and publishing:
        raise ApiError(
            "هویت تعلیق‌شده اجازه انتشار ندارد و با ویرایش پروفایل فعال نمی‌شود.",
            status_code=403,
        )
    if identity.organization is not None and not identity.organization.is_active and publishing:
        raise ApiError("این شرکت غیرفعال است.", status_code=403)


def can_edit_listing(user: User, listing: ProductListing) -> bool:
    if listing.organization_id:
        return OrganizationMember.objects.filter(
            organization_id=listing.organization_id,
            user=user,
            status=MembershipStatus.ACTIVE,
            role__in=PUBLISH_ROLES,
        ).exists()
    return bool(listing.seller_id and listing.seller.user_id == user.pk)


def can_view_inquiries(user: User, listing: ProductListing) -> bool:
    if listing.organization_id:
        return OrganizationMember.objects.filter(
            organization_id=listing.organization_id,
            user=user,
            status=MembershipStatus.ACTIVE,
            role__in=INQUIRY_ROLES,
        ).exists()
    return bool(listing.seller_id and listing.seller.user_id == user.pk)


def sync_trade_members(organization: Organization) -> None:
    user_ids = list(
        organization.memberships.filter(
            status=MembershipStatus.ACTIVE,
            role__in=PUBLISH_ROLES,
        ).values_list("user_id", flat=True)
    )
    organization.members.set(user_ids)


__all__ = [
    "PROFILE_ROLES",
    "PUBLISH_ROLES",
    "VERIFICATION_ROLES",
    "ActiveIdentity",
    "assert_not_suspended",
    "can_edit_listing",
    "can_view_inquiries",
    "identity_or_default",
    "load_active_identity",
    "require_org_role",
    "require_user",
    "switch_identity",
    "sync_trade_members",
]
