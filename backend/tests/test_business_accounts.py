import re

import pytest
from django.core import mail
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client

from apps.accounts.models import User
from apps.core.verification import VerificationStatus
from apps.organizations.business import staff_decide_organization
from apps.organizations.models import MemberRole, MembershipStatus, OrganizationMember
from apps.services.models import ProductListing, SellerProfile, ServiceCategory
from tests.factories import province

pytestmark = pytest.mark.django_db

PASSWORD = "Qw9!sX4mN2#kL7pV"


def user(email: str, phone: str) -> User:
    return User.objects.create_user(
        email=email,
        phone=phone,
        password=PASSWORD,
        first_name="آزما",
        last_name="کاربر",
    )


def otp_from_mailbox() -> str:
    match = re.search(r"\d{6}", mail.outbox[-1].body)
    assert match is not None
    return match.group(0)


def test_phone_registration_does_not_reveal_existing_accounts(client: Client) -> None:
    cache.clear()
    mail.outbox.clear()
    user("owner@example.com", "09120001111")
    started = client.post(
        "/api/v1/auth/phone/otp",
        data={"phone": "09120001111", "email": "intruder@example.com"},
        content_type="application/json",
    )
    assert started.status_code == 200
    assert "قبلاً" not in started.json()["message"]
    assert mail.outbox[-1].to == ["owner@example.com"]

    fresh = client.post(
        "/api/v1/auth/phone/otp",
        data={"phone": "09120002222", "email": "new-seller@example.com"},
        content_type="application/json",
    )
    assert fresh.status_code == 200
    registered = client.post(
        "/api/v1/auth/phone/register",
        data={
            "phone": "09120002222",
            "code": otp_from_mailbox(),
            "email": "owner@example.com",
            "password": PASSWORD,
            "first_name": "نو",
            "last_name": "کاربر",
        },
        content_type="application/json",
    )
    assert registered.status_code == 400
    assert "email" not in registered.json()["error"]["message"].lower()
    assert not User.objects.filter(phone="09120002222").exists()


def test_phone_login_locks_after_repeated_bad_codes(client: Client) -> None:
    cache.clear()
    mail.outbox.clear()
    user("otp@example.com", "09120003333")
    client.post(
        "/api/v1/auth/phone/otp",
        data={"phone": "09120003333"},
        content_type="application/json",
    )
    code = otp_from_mailbox()
    for _ in range(5):
        failed = client.post(
            "/api/v1/auth/phone/login",
            data={"phone": "09120003333", "code": "000000"},
            content_type="application/json",
        )
        assert failed.status_code == 400
    locked = client.post(
        "/api/v1/auth/phone/login",
        data={"phone": "09120003333", "code": code},
        content_type="application/json",
    )
    assert locked.status_code == 400


def test_individual_and_company_identities_switch_and_stay_authorized(client: Client) -> None:
    account = user("multi@example.com", "09120004444")
    client.force_login(account)
    tehran = province("tehran")
    created = client.post(
        "/api/v1/business/individual",
        data={
            "display_name": "کارگاه سارا",
            "professional_title": "تولیدکننده",
            "bio": "محصولات کشاورزی",
            "province_id": tehran.pk,
            "public_phone": "09120004444",
        },
        content_type="application/json",
    )
    assert created.status_code == 201
    duplicate = client.post(
        "/api/v1/business/individual",
        data={"display_name": "دوباره"},
        content_type="application/json",
    )
    assert duplicate.status_code == 409

    company = client.post(
        "/api/v1/business/organizations",
        data={
            "name": "بازرگانی آزمون",
            "organization_type": "trading",
            "national_id": "10101010101",
            "province_id": tehran.pk,
            "phone": "02100000000",
            "representative_name": "سارا",
            "ceo_name": "سارا",
        },
        content_type="application/json",
    )
    assert company.status_code == 201
    company_id = company.json()["id"]
    submitted = client.post(f"/api/v1/business/organizations/{company_id}/submit")
    assert submitted.status_code == 200
    assert submitted.json()["verification_status"] == VerificationStatus.PENDING
    again = client.post(f"/api/v1/business/organizations/{company_id}/submit")
    assert again.status_code == 200

    switched = client.post(
        "/api/v1/business/identity",
        data={"kind": "individual", "id": str(created.json()["id"])},
        content_type="application/json",
    )
    assert switched.status_code == 200
    dashboard = client.get("/api/v1/business/dashboard")
    assert dashboard.json()["kind"] == "individual"

    outsider = user("other@example.com", "09120005555")
    outsider_client = Client()
    outsider_client.force_login(outsider)
    hidden = outsider_client.get(f"/api/v1/business/organizations/{company_id}")
    assert hidden.status_code == 404
    forged = outsider_client.post(
        f"/api/v1/business/organizations/{company_id}/opportunities",
        data={
            "title": "فرصت غیرمجاز",
            "province_id": tehran.pk,
            "opportunity_type": "export",
            "description": "نباید ثبت شود برای شرکت دیگران",
        },
        content_type="application/json",
    )
    assert forged.status_code == 404


def test_membership_roles_and_last_owner(client: Client) -> None:
    owner = user("owner-role@example.com", "09120006666")
    member = user("member-role@example.com", "09120007777")
    client.force_login(owner)
    tehran = province("tehran")
    company = client.post(
        "/api/v1/business/organizations",
        data={"name": "شرکت نقش‌ها", "province_id": tehran.pk, "phone": "02111111111"},
        content_type="application/json",
    )
    company_id = company.json()["id"]
    invited = client.post(
        f"/api/v1/business/organizations/{company_id}/members",
        data={"email": member.email},
        content_type="application/json",
    )
    assert invited.status_code == 200
    membership = OrganizationMember.objects.get(organization_id=company_id, user=member)
    assert membership.status == MembershipStatus.INVITED
    member_client = Client()
    member_client.force_login(member)
    accepted = member_client.post(f"/api/v1/business/memberships/{membership.pk}/accept")
    assert accepted.status_code == 200
    blocked = member_client.post(
        f"/api/v1/business/organizations/{company_id}/opportunities",
        data={
            "title": "فرصت عضو",
            "province_id": tehran.pk,
            "opportunity_type": "export",
            "description": "عضو عادی نباید فرصت بسازد",
        },
        content_type="application/json",
    )
    assert blocked.status_code == 403

    owner_membership = OrganizationMember.objects.get(organization_id=company_id, user=owner)
    demote = client.patch(
        f"/api/v1/business/organizations/{company_id}/members/{owner_membership.pk}",
        data={"role": MemberRole.MEMBER, "status": MembershipStatus.ACTIVE},
        content_type="application/json",
    )
    assert demote.status_code == 400
    owner_membership.refresh_from_db()
    assert owner_membership.role == MemberRole.OWNER


def test_suspended_company_cannot_publish_or_unsuspend_itself(client: Client) -> None:
    owner = user("suspended@example.com", "09120008888")
    client.force_login(owner)
    tehran = province("tehran")
    company = client.post(
        "/api/v1/business/organizations",
        data={"name": "شرکت معلق", "province_id": tehran.pk, "phone": "02122222222"},
        content_type="application/json",
    )
    organization_id = company.json()["id"]
    membership = OrganizationMember.objects.select_related("organization").get(user=owner)
    staff = user("staff-review@example.com", "09120009999")
    staff.is_staff = True
    staff.save(update_fields=["is_staff"])
    staff_decide_organization(staff, membership.organization, VerificationStatus.SUSPENDED)
    edited = client.patch(
        f"/api/v1/business/organizations/{organization_id}",
        data={"name": "نام تازه", "province_id": tehran.pk, "phone": "02122222222"},
        content_type="application/json",
    )
    assert edited.status_code == 200
    assert edited.json()["verification_status"] == VerificationStatus.SUSPENDED
    assert edited.json()["is_active"] is False
    opportunity = client.post(
        f"/api/v1/business/organizations/{organization_id}/opportunities",
        data={
            "title": "فرصت بعد از تعلیق",
            "province_id": tehran.pk,
            "opportunity_type": "import",
            "description": "این درخواست باید رد شود",
        },
        content_type="application/json",
    )
    assert opportunity.status_code == 403


def test_company_listing_is_not_editable_by_another_user(client: Client) -> None:
    owner = user("listing-owner@example.com", "09121110000")
    client.force_login(owner)
    tehran = province("tehran")
    category, _ = ServiceCategory.objects.get_or_create(
        slug="agriculture",
        defaults={"name": "کشاورزی"},
    )
    company = client.post(
        "/api/v1/business/organizations",
        data={"name": "تولیدی آزمون", "province_id": tehran.pk, "phone": "02133333333"},
        content_type="application/json",
    )
    assert company.status_code == 201
    created = client.post(
        "/api/v1/services/my/listings",
        data={
            "category_id": category.pk,
            "province_id": tehran.pk,
            "title": "گندم شرکتی",
            "description": "معرفی محصول شرکت برای فروش داخلی و صادرات",
            "quantity": "10",
            "unit": "تن",
            "listing_kind": "product",
            "submit_for_review": False,
        },
        content_type="application/json",
    )
    assert created.status_code == 201, created.content
    listing = ProductListing.objects.get(pk=created.json()["id"])
    assert listing.organization_id is not None
    assert listing.seller_id is None
    stranger = Client()
    stranger.force_login(user("stranger@example.com", "09121110001"))
    stranger_user = User.objects.get(email="stranger@example.com")
    SellerProfile.objects.create(user=stranger_user, display_name="غریبه")
    edited = stranger.put(
        f"/api/v1/services/my/listings/{listing.pk}",
        data={
            "category_id": category.pk,
            "province_id": tehran.pk,
            "title": "دستکاری",
            "description": "نباید روی آگهی شرکت دیگری ذخیره شود",
            "quantity": "10",
            "unit": "تن",
        },
        content_type="application/json",
    )
    assert edited.status_code == 404


def test_private_document_rejects_unsafe_files(client: Client) -> None:
    account = user("docs@example.com", "09121110002")
    client.force_login(account)
    profile = client.post(
        "/api/v1/business/individual",
        data={"display_name": "استادکار"},
        content_type="application/json",
    )
    identity_id = str(profile.json()["id"])
    rejected = client.post(
        "/api/v1/business/documents",
        {
            "kind": "individual",
            "identity_id": identity_id,
            "document_type": "identity",
            "upload": SimpleUploadedFile(
                "note.exe",
                b"MZ",
                content_type="application/octet-stream",
            ),
        },
    )
    assert rejected.status_code in {400, 422}, rejected.content
    accepted = client.post(
        "/api/v1/business/documents",
        {
            "kind": "individual",
            "identity_id": identity_id,
            "document_type": "identity",
            "upload": SimpleUploadedFile("card.pdf", b"%PDF-1.4", content_type="application/pdf"),
        },
    )
    assert accepted.status_code == 201, accepted.content
    downloaded = client.get(f"/api/v1/business/documents/{accepted.json()['id']}/file")
    assert downloaded.status_code == 200
    outsider = Client()
    outsider.force_login(user("docs-other@example.com", "09121110003"))
    hidden = outsider.get(f"/api/v1/business/documents/{accepted.json()['id']}/file")
    assert hidden.status_code == 404


def test_profile_image_rejects_unsupported_types(client: Client) -> None:
    account = user("image@example.com", "09121110004")
    client.force_login(account)
    created = client.post(
        "/api/v1/business/individual",
        data={"display_name": "باغبان"},
        content_type="application/json",
    )
    assert created.status_code == 201
    rejected = client.post(
        "/api/v1/business/individual/image",
        {
            "slot": "profile",
            "upload": SimpleUploadedFile("mark.gif", b"GIF89a", content_type="image/gif"),
        },
    )
    assert rejected.status_code == 400, rejected.content
