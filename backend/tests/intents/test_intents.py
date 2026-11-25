import uuid
from datetime import timedelta
from io import StringIO

import pytest
from django.contrib.auth.models import Permission
from django.core.cache import cache
from django.core.management import call_command
from django.test import Client
from django.utils import timezone

from apps.accounts.models import User
from apps.accounts.phone import _key
from apps.intents.models import FollowUpStatus, UserIntent
from apps.intents.services import claim_guest_intent, token_hash

API = "/api/v1/intents"


def _guest(client: Client, token: uuid.UUID, **overrides):
    payload = {
        "token": str(token),
        "goals": ["offering"],
        "contact_phone": "",
        "contact_consent": False,
        **overrides,
    }
    return client.post(f"{API}/guest", data=payload, content_type="application/json")


def _user(index: int, *, staff: bool = False, superuser: bool = False) -> User:
    return User.objects.create_user(
        email=f"intent-{index}@example.invalid",
        phone=f"0912000{index:04d}",
        password="ExamplePassword!2026",
        is_staff=staff,
        is_superuser=superuser,
    )


@pytest.mark.django_db
def test_guest_without_phone_is_idempotent_and_stores_only_token_hash():
    cache.clear()
    client = Client(REMOTE_ADDR="192.0.2.1")
    token = uuid.uuid4()
    first = _guest(client, token)
    second = _guest(client, token)
    assert first.status_code == second.status_code == 201
    assert UserIntent.objects.count() == 1
    record = UserIntent.objects.get()
    assert record.goals == ["offering"]
    assert record.contact_phone == ""
    assert record.contact_consent is False
    assert record.guest_token_hash == token_hash(token)
    assert str(token) not in record.guest_token_hash


@pytest.mark.django_db
def test_guest_mobile_normalization_consent_and_invalid_mobile():
    cache.clear()
    client = Client(REMOTE_ADDR="192.0.2.2")
    invalid = _guest(client, uuid.uuid4(), contact_phone="12345")
    assert invalid.status_code == 400
    long_number = "0912" * 40
    oversized = _guest(client, uuid.uuid4(), contact_phone=long_number)
    assert oversized.status_code == 400
    assert long_number not in oversized.content.decode()
    assert UserIntent.objects.count() == 0
    valid = _guest(
        client,
        uuid.uuid4(),
        contact_phone="۰۹۱۲۳۴۵۶۷۸۹",
        contact_consent=True,
    )
    assert valid.status_code == 201
    record = UserIntent.objects.get()
    assert record.contact_phone == "09123456789"
    assert record.contact_consent is True
    assert record.consent_at is not None
    assert record.consent_text_version
    missing = _guest(client, uuid.uuid4(), contact_consent=True)
    assert missing.status_code == 400


@pytest.mark.django_db
def test_authenticated_create_edit_and_exclusive_exploring_goal():
    client = Client()
    assert client.get(f"{API}/me").status_code == 401
    user = _user(1)
    client.force_login(user)
    initial = client.get(f"{API}/me")
    assert initial.json()["has_intent"] is False
    assert "no-store" in initial.headers["Cache-Control"]
    created = client.post(
        f"{API}/me",
        data={"goals": ["company_owner"]},
        content_type="application/json",
    )
    assert created.status_code == 201
    assert created.json()["has_intent"] is True
    duplicate = client.post(
        f"{API}/me", data={"goals": ["offering"]}, content_type="application/json"
    )
    assert duplicate.status_code == 409
    changed = client.put(
        f"{API}/me/goals",
        data={"goals": ["company_owner", "seek_opportunity"]},
        content_type="application/json",
    )
    assert changed.status_code == 200
    assert changed.json()["goals"] == ["company_owner", "seek_opportunity"]
    invalid = client.put(
        f"{API}/me/goals",
        data={"goals": ["exploring", "offering"]},
        content_type="application/json",
    )
    assert invalid.status_code == 400
    cleared = client.put(f"{API}/me/goals", data={"goals": []}, content_type="application/json")
    assert cleared.status_code == 200
    assert cleared.json()["has_intent"] is True
    assert cleared.json()["goals"] == []


@pytest.mark.django_db
def test_registration_claims_guest_intent_without_verifying_lead_phone():
    cache.clear()
    client = Client(REMOTE_ADDR="192.0.2.3")
    token = uuid.uuid4()
    assert _guest(client, token, contact_phone="۰۹۱۲۳۴۵۶۷۸۹").status_code == 201
    response = client.post(
        "/api/v1/auth/register",
        data={
            "email": "joined@example.invalid",
            "phone": "09129999999",
            "password": "SafeRegistration!2026",
            "guest_intent_token": str(token),
        },
        content_type="application/json",
    )
    assert response.status_code == 201
    assert response.json()["intent_claimed"] is True
    user = User.objects.get(email="joined@example.invalid")
    record = UserIntent.objects.get(user=user)
    assert record.guest_token_hash is None
    assert record.contact_phone == "09123456789"
    assert user.phone == "09129999999"
    assert UserIntent.objects.count() == 1


@pytest.mark.django_db
def test_phone_registration_claims_guest_intent_and_starts_session():
    cache.clear()
    client = Client(REMOTE_ADDR="192.0.2.8")
    token = uuid.uuid4()
    assert _guest(client, token, goals=["seek_opportunity"]).status_code == 201
    phone = "09121112233"
    cache.set(_key(phone), {"code": "123456", "attempts": 0}, timeout=300)
    response = client.post(
        "/api/v1/auth/phone/register",
        data={
            "phone": phone,
            "code": "123456",
            "email": "phone-joined@example.invalid",
            "password": "PhoneRegistration!2026",
            "first_name": "سارا",
            "last_name": "احمدی",
            "guest_intent_token": str(token),
        },
        content_type="application/json",
    )
    assert response.status_code == 201
    assert response.json()["intent_claimed"] is True
    assert client.get("/api/v1/auth/me").status_code == 200
    user = User.objects.get(email="phone-joined@example.invalid")
    assert UserIntent.objects.get(user=user).goals == ["seek_opportunity"]


@pytest.mark.django_db
def test_claim_merges_goals_without_changing_existing_consent():
    cache.clear()
    user = _user(2)
    client = Client(REMOTE_ADDR="192.0.2.4")
    client.force_login(user)
    assert (
        client.post(
            f"{API}/me", data={"goals": ["exploring"]}, content_type="application/json"
        ).status_code
        == 201
    )
    client.logout()
    token = uuid.uuid4()
    assert (
        _guest(
            client,
            token,
            goals=["offering"],
            contact_phone="09123456789",
            contact_consent=True,
        ).status_code
        == 201
    )
    assert claim_guest_intent(user, token) is True
    account = UserIntent.objects.get(user=user)
    assert account.goals == ["offering"]
    assert account.contact_phone == "09123456789"
    assert account.contact_consent is False
    archived = UserIntent.objects.get(merged_into=user)
    assert archived.guest_token_hash is None
    assert archived.contact_phone == ""
    assert claim_guest_intent(user, token) is False
    assert UserIntent.objects.filter(merged_into__isnull=True).count() == 1


@pytest.mark.django_db
def test_guest_rate_limit_and_csrf():
    cache.clear()
    client = Client(REMOTE_ADDR="192.0.2.5")
    for _ in range(10):
        assert _guest(client, uuid.uuid4()).status_code == 201
    assert _guest(client, uuid.uuid4()).status_code == 429
    csrf_client = Client(enforce_csrf_checks=True)
    assert _guest(csrf_client, uuid.uuid4()).status_code == 403


@pytest.mark.django_db
def test_admin_leads_require_explicit_contact_permission():
    staff = _user(3, staff=True)
    staff.user_permissions.add(Permission.objects.get(codename="view_userintent"))
    client = Client()
    client.force_login(staff)
    url = "/admin/intents/userintent/"
    denied = client.get(url)
    assert denied.status_code == 403
    staff.user_permissions.add(Permission.objects.get(codename="view_lead_contact"))
    allowed = client.get(url)
    assert allowed.status_code == 200
    assert "اهداف کاربران و سرنخ‌های تجاری" in allowed.content.decode()
    assert "رکورد فعال" in allowed.content.decode()
    assert FollowUpStatus.NEW == "new"


@pytest.mark.django_db
def test_user_can_remove_unverified_lead_contact_without_erasing_goals():
    user = _user(4)
    client = Client()
    client.force_login(user)
    created = client.post(
        f"{API}/me",
        data={
            "goals": ["offering"],
            "contact_phone": "09123456789",
            "contact_consent": True,
        },
        content_type="application/json",
    )
    assert created.status_code == 201
    removed = client.delete(f"{API}/me/contact")
    assert removed.status_code == 200
    assert removed.json()["contact_phone"] == ""
    assert removed.json()["contact_consent"] is False
    record = UserIntent.objects.get(user=user)
    assert record.goals == ["offering"]
    assert record.consent_at is not None


@pytest.mark.django_db
def test_expiry_command_is_preview_first_and_anonymizes_without_deleting():
    cache.clear()
    client = Client(REMOTE_ADDR="192.0.2.9")
    token = uuid.uuid4()
    assert _guest(client, token, contact_phone="09123456789").status_code == 201
    record = UserIntent.objects.get()
    UserIntent.objects.filter(pk=record.pk).update(created_at=timezone.now() - timedelta(days=181))
    preview = StringIO()
    call_command("expire_intent_contacts", stdout=preview)
    record.refresh_from_db()
    assert "1 guest intent records" in preview.getvalue()
    assert record.contact_phone == "09123456789"
    applied = StringIO()
    call_command("expire_intent_contacts", apply=True, stdout=applied)
    record.refresh_from_db()
    assert UserIntent.objects.count() == 1
    assert record.contact_phone == ""
    assert record.guest_token_hash is None
    assert record.goals == ["offering"]
