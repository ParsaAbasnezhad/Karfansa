import pytest
from django.contrib.auth import get_user_model
from django.test import Client

from apps.management.access import has_control_center_access
from apps.management.models import AdminProfile, AdminRole
from apps.management.role_templates import ROLE_TEMPLATES, ensure_default_role_templates


@pytest.mark.django_db
def test_control_center_access_rules() -> None:
    User = get_user_model()
    ordinary = User.objects.create_user(
        email="ordinary-access@example.test",
        password="a-strong-administrator-password",
        phone="+989120000201",
    )
    assert has_control_center_access(ordinary) is False

    staff = User.objects.create_user(
        email="staff-access@example.test",
        password="a-strong-administrator-password",
        phone="+989120000202",
        is_staff=True,
    )
    assert has_control_center_access(staff) is False
    AdminProfile.objects.create(user=staff)
    assert has_control_center_access(staff) is True

    AdminProfile.objects.filter(user=staff).update(suspended=True)
    staff.refresh_from_db()
    assert has_control_center_access(staff) is False

    root = User.objects.create_superuser(
        email="root-access@example.test",
        password="a-strong-administrator-password",
        phone="+989120000203",
    )
    assert has_control_center_access(root) is True


@pytest.mark.django_db
def test_auth_me_exposes_control_center_access_flag() -> None:
    User = get_user_model()
    user = User.objects.create_superuser(
        email="me-access@example.test",
        password="a-strong-administrator-password",
        phone="+989120000204",
    )
    AdminProfile.objects.create(user=user)
    client = Client()
    client.force_login(user)
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 200
    assert response.json()["control_center_access"] is True


@pytest.mark.django_db
def test_default_role_templates_are_seeded_once() -> None:
    created = ensure_default_role_templates()
    assert len(created) == len(ROLE_TEMPLATES)
    assert AdminRole.objects.count() == len(ROLE_TEMPLATES)
    again = ensure_default_role_templates()
    assert again == []
    support = AdminRole.objects.get(name="تیم پشتیبانی")
    assert any(code.startswith("support.") for code in support.action_codes)
    assert "management.adminprofile.manage_permissions" not in support.action_codes
