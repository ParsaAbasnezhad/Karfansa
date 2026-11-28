import pytest
from django.contrib.auth import get_user_model
from django.test import Client

from apps.management.models import AdminProfile, AdminRole, AdminRoleAssignment
from apps.management.permissions import can_manage, effective_action_codes
from apps.management.role_templates import ensure_default_role_templates


@pytest.mark.django_db
def test_support_role_template_grants_ticket_view_but_not_security_admin() -> None:
    ensure_default_role_templates()
    User = get_user_model()
    user = User.objects.create_user(
        email="support-role@example.test",
        password="a-strong-administrator-password",
        phone="+989120000301",
        is_staff=True,
    )
    AdminProfile.objects.create(user=user)
    role = AdminRole.objects.get(name="تیم پشتیبانی")
    AdminRoleAssignment.objects.create(user=user, role=role)

    codes = effective_action_codes(user)
    assert any(code.startswith("support.supportticket.") for code in codes)
    assert "management.adminprofile.manage_permissions" not in codes
    assert can_manage(user, "support", "supportticket", "view")
    assert not can_manage(user, "management", "adminprofile", "manage_permissions")


@pytest.mark.django_db
def test_duplicate_role_endpoint_copies_action_codes() -> None:
    User = get_user_model()
    root = User.objects.create_superuser(
        email="dup-root@example.test",
        password="a-strong-administrator-password",
        phone="+989120000302",
    )
    AdminProfile.objects.create(user=root)
    role = AdminRole.objects.create(
        name="Custom Ops",
        description="ops",
        action_codes=["support.supportticket.view", "support.supportticket.update"],
    )
    client = Client(enforce_csrf_checks=True)
    csrf = client.get("/api/v1/management/auth/csrf", secure=True, HTTP_HOST="localhost")
    token = csrf.json()["csrf_token"]
    login = client.post(
        "/api/v1/management/auth/login",
        data='{"email":"dup-root@example.test","password":"a-strong-administrator-password"}',
        content_type="application/json",
        HTTP_X_CSRFTOKEN=token,
        HTTP_REFERER="https://localhost/",
        secure=True,
        HTTP_HOST="localhost",
    )
    assert login.status_code == 200
    reauth = client.post(
        "/api/v1/management/auth/reauth",
        data='{"password":"a-strong-administrator-password"}',
        content_type="application/json",
        HTTP_X_CSRFTOKEN=token,
        HTTP_REFERER="https://localhost/",
        secure=True,
        HTTP_HOST="localhost",
    )
    assert reauth.status_code == 200
    response = client.post(
        f"/api/v1/management/security/roles/{role.pk}/duplicate",
        content_type="application/json",
        HTTP_X_CSRFTOKEN=token,
        HTTP_REFERER="https://localhost/",
        secure=True,
        HTTP_HOST="localhost",
    )
    assert response.status_code == 201
    body = response.json()
    assert body["name"].startswith("کپی ")
    assert body["action_codes"] == role.action_codes
