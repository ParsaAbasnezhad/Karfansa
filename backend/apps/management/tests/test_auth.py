import json
from datetime import timedelta
from io import StringIO

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import Client
from django.test.utils import override_settings
from django.utils import timezone

from apps.management.models import AdminAuditEvent, AdminProfile, AdminSession
from apps.management.totp import create_recovery_codes


def _csrf_client() -> tuple[Client, str]:
    client = Client(enforce_csrf_checks=True)
    response = client.get(
        "/api/v1/management/auth/csrf", secure=True, HTTP_HOST="localhost"
    )
    assert response.status_code == 200
    return client, response.json()["csrf_token"]


def _password_login(client: Client, csrf_token: str, email: str, password: str):
    return client.post(
        "/api/v1/management/auth/login",
        data=json.dumps({"email": email, "password": password}),
        content_type="application/json",
        HTTP_X_CSRFTOKEN=csrf_token,
        HTTP_REFERER="https://localhost/",
        secure=True,
        HTTP_HOST="localhost",
    )


@pytest.mark.django_db
def test_superuser_can_login_with_password_only_and_old_totp_secret_is_invalidated() -> None:
    User = get_user_model()
    user = User.objects.create_superuser(
        email="root@example.test",
        password="a-strong-administrator-password",
        phone="+989120000091",
    )
    _recovery_codes, recovery_hashes = create_recovery_codes()
    profile = AdminProfile.objects.create(
        user=user,
        mfa_seed="a" * 64,
        mfa_confirmed=True,
        recovery_code_hashes=recovery_hashes,
    )
    client, csrf_token = _csrf_client()

    response = _password_login(
        client, csrf_token, " ROOT@EXAMPLE.TEST ", "a-strong-administrator-password"
    )

    assert response.status_code == 200
    assert response.json()["mfa_required"] is False
    assert response.json()["mfa_setup_required"] is False
    assert response.json()["admin"]["is_superuser"] is True
    assert response.json()["admin"]["mfa_required"] is False
    assert response.cookies["karfansa_console_session"]["httponly"]
    profile.refresh_from_db()
    assert not profile.mfa_seed
    assert not profile.mfa_confirmed
    assert profile.recovery_code_hashes == []
    assert AdminSession.objects.filter(user=user, revoked_at__isnull=True).exists()

    me = client.get("/api/v1/management/auth/me", secure=True, HTTP_HOST="localhost")
    assert me.status_code == 200
    assert me.json()["email"] == user.email
    assert AdminAuditEvent.objects.filter(actor=user, action="auth.login").exists()

    reauth = client.post(
        "/api/v1/management/auth/reauth",
        data=json.dumps({"password": "a-strong-administrator-password"}),
        content_type="application/json",
        HTTP_X_CSRFTOKEN=csrf_token,
        HTTP_REFERER="https://localhost/",
        secure=True,
        HTTP_HOST="localhost",
    )
    assert reauth.status_code == 200
    verify = client.post(
        "/api/v1/management/auth/verify",
        data=json.dumps({"code": "123456"}),
        content_type="application/json",
        HTTP_X_CSRFTOKEN=csrf_token,
        HTTP_REFERER="https://localhost/",
        HTTP_HOST="localhost",
        secure=True,
    )
    assert verify.status_code == 404


@pytest.mark.django_db
@override_settings(MANAGEMENT_MFA_REQUIRED=True)
def test_mfa_cannot_be_reenabled_through_settings_override() -> None:
    """Even if a process mistakenly flips the legacy flag, login stays password-only."""
    User = get_user_model()
    user = User.objects.create_superuser(
        email="mfa-root@example.test",
        password="a-strong-administrator-password",
        phone="+989120000092",
    )
    client, csrf_token = _csrf_client()

    response = _password_login(
        client, csrf_token, user.email, "a-strong-administrator-password"
    )

    assert response.status_code == 200
    assert response.json()["mfa_required"] is False
    assert response.json()["mfa_setup_required"] is False
    assert response.json()["admin"]["email"] == user.email
    assert AdminSession.objects.filter(user=user, revoked_at__isnull=True).exists()
    assert client.get(
        "/api/v1/management/auth/me", secure=True, HTTP_HOST="localhost"
    ).status_code == 200
    assert client.post(
        "/api/v1/management/auth/mfa/setup",
        data=json.dumps({"enrollment_code": "x"}),
        content_type="application/json",
        HTTP_X_CSRFTOKEN=csrf_token,
        HTTP_REFERER="https://localhost/",
        secure=True,
        HTTP_HOST="localhost",
    ).status_code == 404


@pytest.mark.django_db
def test_ordinary_user_cannot_create_a_management_session_with_valid_password() -> None:
    User = get_user_model()
    user = User.objects.create_user(
        email="ordinary@example.test",
        password="a-strong-administrator-password",
        phone="+989120000093",
    )
    client, csrf_token = _csrf_client()

    response = _password_login(
        client, csrf_token, user.email, "a-strong-administrator-password"
    )

    assert response.status_code == 401
    assert not AdminProfile.objects.filter(user=user).exists()
    assert not AdminSession.objects.filter(user=user).exists()


@pytest.mark.django_db
def test_bootstrap_without_mfa_invalidates_existing_totp_and_revokes_sessions() -> None:
    User = get_user_model()
    user = User.objects.create_user(
        email="bootstrap-root@example.test",
        phone="+989120000094",
    )
    user.is_staff = True
    user.is_superuser = True
    user.save(update_fields=["is_staff", "is_superuser"])
    _recovery_codes, recovery_hashes = create_recovery_codes()
    profile = AdminProfile.objects.create(
        user=user,
        mfa_seed="b" * 64,
        enrollment_code_hash="previous-enrollment-hash",
        mfa_confirmed=True,
        recovery_code_hashes=recovery_hashes,
        last_totp_step=123,
    )
    session = AdminSession.objects.create(
        user=user,
        key_digest="c" * 64,
        expires_at=timezone.now() + timedelta(hours=1),
    )

    call_command(
        "bootstrap_management_admin",
        email=user.email,
        stdout=StringIO(),
    )

    profile.refresh_from_db()
    session.refresh_from_db()
    assert profile.mfa_seed == ""
    assert profile.enrollment_code_hash == ""
    assert profile.mfa_confirmed is False
    assert profile.recovery_code_hashes == []
    assert session.revoked_at is not None
