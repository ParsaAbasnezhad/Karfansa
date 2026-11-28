from types import SimpleNamespace

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from django.contrib.contenttypes.models import ContentType
from ninja.errors import HttpError

from apps.management.api import security
from apps.management.models import AdminProfile, AdminRole, AdminRoleAssignment
from apps.management.schemas.security import DjangoGroupIn, GroupMembersIn


@pytest.mark.django_db
def test_super_administrator_can_create_group_with_django_permissions(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    User = get_user_model()
    actor = User.objects.create_superuser(
        email="root@example.test",
        password="test-passphrase",
        phone="+989120000010",
    )
    permission = Permission.objects.get(
        content_type=ContentType.objects.get_for_model(Group),
        codename="view_group",
    )
    request = SimpleNamespace(META={}, management_actor=actor)
    monkeypatch.setattr(security, "_permissions_scope", lambda *_args, **_kwargs: actor)

    status, created = security.create_group(
        request,
        DjangoGroupIn(name="Operations", permission_ids=[permission.pk]),
    )

    assert status == 201
    group = Group.objects.get(pk=created.id)
    assert group.name == "Operations"
    assert list(group.permissions.values_list("pk", flat=True)) == [permission.pk]
    assert created.permission_ids == [permission.pk]


@pytest.mark.django_db
def test_delegated_administrator_cannot_grant_permissions_outside_scope() -> None:
    User = get_user_model()
    actor = User.objects.create_user(
        email="delegated@example.test",
        password="test-passphrase",
        phone="+989120000011",
        is_staff=True,
    )
    AdminProfile.objects.create(user=actor, mfa_confirmed=True)
    permission = Permission.objects.get(
        content_type=ContentType.objects.get_for_model(Group),
        codename="view_group",
    )

    with pytest.raises(HttpError, match="exceeds your scope"):
        security._validate_group_permissions(actor, [permission.pk])


@pytest.mark.django_db
def test_delegated_administrator_cannot_remove_superuser_from_group(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    User = get_user_model()
    root = User.objects.create_superuser(
        email="protected@example.test",
        password="test-passphrase",
        phone="+989120000012",
    )
    actor = User.objects.create_user(
        email="delegated@example.test",
        password="test-passphrase",
        phone="+989120000013",
        is_staff=True,
    )
    AdminProfile.objects.create(user=actor, mfa_confirmed=True)
    group = Group.objects.create(name="Protected")
    group.user_set.add(root)
    request = SimpleNamespace(META={}, management_actor=actor)
    monkeypatch.setattr(security, "_permissions_scope", lambda *_args, **_kwargs: actor)
    monkeypatch.setattr(security, "require_management", lambda *_args, **_kwargs: actor)

    with pytest.raises(HttpError, match="Protected administrator"):
        security.set_group_members(request, group.pk, GroupMembersIn(user_ids=[]))

    assert group.user_set.filter(pk=root.pk).exists()


@pytest.mark.django_db
def test_administrator_access_grant_is_password_only_without_blanket_permissions(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    User = get_user_model()
    actor = User.objects.create_superuser(
        email="root@example.test",
        password="test-passphrase",
        phone="+989120000014",
    )
    target = User.objects.create_user(
        email="new-admin@example.test",
        password="test-passphrase",
        phone="+989120000015",
    )
    request = SimpleNamespace(META={}, management_actor=actor)
    monkeypatch.setattr(security, "_target", lambda *_args, **_kwargs: target)
    monkeypatch.setattr(security, "_permissions_scope", lambda *_args, **_kwargs: actor)

    result = security.grant_administrator(request, target.pk)

    target.refresh_from_db()
    profile = AdminProfile.objects.get(user=target)
    assert target.is_staff
    assert not profile.suspended
    assert not profile.mfa_confirmed
    assert profile.enrollment_code_hash == ""
    assert profile.mfa_seed == ""
    assert profile.individual_actions == []
    assert result.enrollment_code is None
    assert AdminRoleAssignment.objects.filter(user=target).count() == 0


@pytest.mark.django_db
def test_administrator_revocation_clears_grants_and_protects_last_superuser(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    User = get_user_model()
    root = User.objects.create_superuser(
        email="root@example.test",
        password="test-passphrase",
        phone="+989120000016",
    )
    AdminProfile.objects.create(user=root)
    role_user = User.objects.create_user(
        email="delegated@example.test",
        password="test-passphrase",
        phone="+989120000017",
        is_staff=True,
    )
    profile = AdminProfile.objects.create(user=role_user, individual_actions=["accounts.user.view"])
    role = AdminRole.objects.create(name="Operators")
    AdminRoleAssignment.objects.create(user=role_user, role=role)
    request = SimpleNamespace(META={}, management_actor=root)
    monkeypatch.setattr(security, "_permissions_scope", lambda *_args, **_kwargs: root)
    monkeypatch.setattr(security, "_target", lambda _request, user_id, *_args, **_kwargs: User.objects.get(pk=user_id))

    security.revoke_administrator(request, role_user.pk)
    role_user.refresh_from_db()
    profile.refresh_from_db()
    assert not role_user.is_staff
    assert profile.suspended
    assert profile.individual_actions == []
    assert not AdminRoleAssignment.objects.filter(user=role_user).exists()

    with pytest.raises(HttpError, match="Last active Super Administrator"):
        security.revoke_administrator(request, root.pk)
