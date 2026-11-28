"""Explicit administrator, role, session and audit operations.

No route accepts arbitrary model fields or exposes password material.
"""

import re

from django.apps import apps
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import connection, transaction
from django.db.models import F, Q
from django.http import HttpRequest
from django.utils import timezone
from ninja import Router
from ninja.errors import HttpError

from apps.accounts.services import send_password_reset
from apps.management.audit import audit_management
from apps.management.models import (
    AdminAuditEvent,
    AdminObjectGrant,
    AdminProfile,
    AdminRole,
    AdminRoleAssignment,
    AdminSession,
)
from apps.management.permissions import (
    MANAGEMENT_ACTIONS,
    can_manage,
    require_management,
    require_recent_reauthentication,
    scope_queryset,
)
from apps.management.resources.registry import RESOURCES
from apps.management.schemas.security import (
    AuditListOut,
    AuditOut,
    DjangoGroupIn,
    DjangoGroupListOut,
    DjangoGroupOut,
    DjangoPermissionOption,
    GroupMembersIn,
    IndividualPermissionsIn,
    MessageOut,
    ObjectGrantIn,
    ObjectGrantListOut,
    ObjectGrantOut,
    PermissionOption,
    RoleAssignmentsIn,
    RoleIn,
    RoleListOut,
    RoleOut,
    SessionListOut,
    SessionOut,
    UserCreateIn,
    UserCreateOut,
    UserListOut,
    UserRow,
    UserUpdateIn,
)
from apps.management.signals import revoke_management_sessions

router = Router()
User = get_user_model()
ACTION_PATTERN = re.compile(r"^([a-z][a-z0-9_]*)\.([a-z][a-z0-9_]*)\.([a-z][a-z_]*)$")
SPECIAL_MODELS = {("management", "dashboard"), ("management", "systemhealth")}


def _page(limit: int, offset: int) -> tuple[int, int]:
    if limit < 1 or limit > 100 or offset < 0:
        raise HttpError(400, "Invalid pagination")
    return limit, offset


def _normalized(value: str) -> str:
    return value.strip().replace("ي", "ی").replace("ك", "ک")[:120]


def _user_row(user) -> UserRow:  # type: ignore[no-untyped-def]
    profile = getattr(user, "management_profile", None)
    return UserRow(
        id=user.pk, email=user.email, phone=user.phone,
        first_name=user.first_name, last_name=user.last_name,
        is_active=user.is_active, is_staff=user.is_staff,
        is_superuser=user.is_superuser, date_joined=user.date_joined,
        mfa_confirmed=bool(profile and profile.mfa_confirmed),
        suspended=bool(profile and profile.suspended),
        role_ids=[assignment.role_id for assignment in user.management_roles.all()],
        individual_action_codes=list(profile.individual_actions) if profile else [],
    )


def _target(request: HttpRequest, user_id: int, action: str = "view"):  # type: ignore[no-untyped-def]
    user = (
        User.objects.select_related("management_profile")
        .prefetch_related("management_roles")
        .filter(pk=user_id)
        .first()
    )
    if user is None:
        raise HttpError(404, "User not found")
    require_management(request, "accounts", "user", action, obj=user)
    return user


def _permissions_scope(request: HttpRequest, target=None):  # type: ignore[no-untyped-def]
    actor = require_management(request, "management", "adminprofile", "manage_permissions")
    require_recent_reauthentication(request)
    if target is not None and target.is_superuser and not actor.is_superuser:
        raise HttpError(403, "Protected administrator")
    return actor


def _validate_codes(actor, codes: list[str]) -> list[str]:  # type: ignore[no-untyped-def]
    if len(codes) > 300 or len(set(codes)) != len(codes):
        raise HttpError(400, "Invalid permission list")
    for code in codes:
        match = ACTION_PATTERN.fullmatch(code)
        if match is None:
            raise HttpError(400, "Invalid permission code")
        app_label, model_name, action = match.groups()
        if action not in MANAGEMENT_ACTIONS:
            raise HttpError(400, "Invalid permission action")
        if (app_label, model_name) not in SPECIAL_MODELS:
            try:
                apps.get_model(app_label, model_name)
            except LookupError as exc:
                raise HttpError(400, "Unknown permission target") from exc
        if model_name == "adminauditevent" and action not in {"view", "export"}:
            raise HttpError(400, "Audit history is immutable")
        if not actor.is_superuser and not can_manage(actor, app_label, model_name, action):
            raise HttpError(403, "Permission exceeds your scope")
    return sorted(codes)


def _role_row(role: AdminRole) -> RoleOut:
    return RoleOut(
        id=role.pk, name=role.name, description=role.description,
        action_codes=list(role.action_codes), is_active=role.is_active,
    )


def _object_grant_row(grant: AdminObjectGrant) -> ObjectGrantOut:
    return ObjectGrantOut(
        id=grant.pk, app_label=grant.content_type.app_label,
        model_name=grant.content_type.model, object_id=grant.object_id,
        actions=list(grant.actions),
    )


def _group_row(group: Group, include_members: bool = False) -> DjangoGroupOut:
    permissions = list(group.permissions.select_related("content_type").order_by("content_type__app_label", "codename"))
    member_count = group.user_set.count()
    return DjangoGroupOut(
        id=group.pk,
        name=group.name,
        permission_ids=[permission.pk for permission in permissions],
        permission_labels=[
            f"{permission.content_type.app_label}.{permission.content_type.model} · {permission.name}"
            for permission in permissions
        ],
        member_count=member_count,
        member_ids=(
            list(group.user_set.order_by("pk").values_list("pk", flat=True)[:500])
            if include_members else []
        ),
        members_truncated=include_members and member_count > 500,
    )


def _validate_group_permissions(actor, permission_ids: list[int]) -> list[Permission]:  # type: ignore[no-untyped-def]
    if len(permission_ids) > 500 or len(set(permission_ids)) != len(permission_ids):
        raise HttpError(400, "Invalid group permission list")
    permissions = list(
        Permission.objects.filter(pk__in=permission_ids).select_related("content_type")
    )
    if len(permissions) != len(permission_ids):
        raise HttpError(400, "Unknown group permission")
    verb_map = {"view": "view", "add": "create", "change": "update", "delete": "delete"}
    for permission in permissions:
        verb, separator, _model = permission.codename.partition("_")
        action = verb_map.get(verb) if separator else None
        app_label = permission.content_type.app_label
        model_name = permission.content_type.model
        if action is None or (app_label, model_name) in {
            ("management", "adminauditevent"),
            ("management", "adminsession"),
            ("management", "adminprofile"),
        }:
            raise HttpError(403, "This Django permission cannot be assigned to a group")
        if not actor.is_superuser and not can_manage(actor, app_label, model_name, action):
            raise HttpError(403, "Group permission exceeds your scope")
    return permissions


def _protect_last_superuser(user) -> None:  # type: ignore[no-untyped-def]
    if not user.is_superuser or not user.is_active:
        return
    active = User.objects.filter(
        is_superuser=True, is_staff=True, is_active=True,
        management_profile__suspended=False,
    ).count()
    if active <= 1:
        raise HttpError(409, "Last active Super Administrator is protected")


def _serialize_superuser_status_change() -> None:
    """Serialize concurrent suspensions before reading the last-admin count."""
    if connection.vendor == "postgresql":
        with connection.cursor() as cursor:
            cursor.execute("SELECT pg_advisory_xact_lock(71384720152026)")


@router.get("/users", response=UserListOut)
def users(request: HttpRequest, q: str = "", limit: int = 25, offset: int = 0) -> UserListOut:
    require_management(request, "accounts", "user", "view")
    limit, offset = _page(limit, offset)
    queryset = scope_queryset(request, User.objects.select_related("management_profile").prefetch_related("management_roles"))
    q = _normalized(q)
    if q:
        queryset = queryset.filter(Q(email__icontains=q) | Q(phone__icontains=q) | Q(first_name__icontains=q) | Q(last_name__icontains=q))
    total = queryset.count()
    return UserListOut(items=[_user_row(user) for user in queryset.order_by("-date_joined", "-pk")[offset:offset+limit]], total=total, limit=limit, offset=offset)


@router.post("/users", response={201: UserCreateOut})
def create_user(request: HttpRequest, payload: UserCreateIn):
    require_management(request, "accounts", "user", "create")
    if payload.administrator:
        _permissions_scope(request)
    email = payload.email.strip().lower()
    phone = payload.phone.strip()
    try:
        validate_email(email)
    except ValidationError as exc:
        raise HttpError(400, "Invalid email") from exc
    if not phone or len(phone) > 32 or len(email) > 254:
        raise HttpError(400, "Invalid contact information")
    if User.objects.filter(Q(email__iexact=email) | Q(phone=phone)).exists():
        raise HttpError(409, "Account already exists")
    enrollment_code = None
    with transaction.atomic():
        user = User.objects.create_user(
            email=email, phone=phone,
            first_name=payload.first_name.strip()[:150],
            last_name=payload.last_name.strip()[:150],
            is_staff=payload.administrator,
        )
        if payload.administrator:
            AdminProfile.objects.create(user=user)
        audit_management(request, "user.create", user, changed_fields=["email", "phone", "first_name", "last_name", "is_staff"])
        transaction.on_commit(lambda: send_password_reset(user.email))
    return 201, UserCreateOut(user=_user_row(user), enrollment_code=enrollment_code)


@router.get("/users/{user_id}", response=UserRow)
def user_detail(request: HttpRequest, user_id: int) -> UserRow:
    return _user_row(_target(request, user_id))


@router.patch("/users/{user_id}", response=UserRow)
def update_user(request: HttpRequest, user_id: int, payload: UserUpdateIn) -> UserRow:
    user = _target(request, user_id, "update")
    if user.is_superuser and not request.management_actor.is_superuser:  # type: ignore[attr-defined]
        raise HttpError(403, "Protected administrator")
    user.first_name = payload.first_name.strip()[:150]
    user.last_name = payload.last_name.strip()[:150]
    user.save(update_fields=["first_name", "last_name"])
    audit_management(request, "user.update", user, changed_fields=["first_name", "last_name"])
    return _user_row(user)


@router.post("/users/{user_id}/suspend", response=UserRow)
def suspend_user(request: HttpRequest, user_id: int) -> UserRow:
    user = _target(request, user_id, "suspend")
    if user.is_staff:
        _permissions_scope(request, user)
    with transaction.atomic():
        if user.is_superuser:
            _serialize_superuser_status_change()
        locked = User.objects.select_for_update().get(pk=user.pk)
        _protect_last_superuser(locked)
        if locked.is_staff:
            profile = AdminProfile.objects.select_for_update().get(user=locked)
            profile.suspended = True
            profile.save(update_fields=["suspended", "updated_at"])
            revoke_management_sessions(locked.pk)
        else:
            locked.is_active = False
            locked.save(update_fields=["is_active"])
        audit_management(request, "user.suspend", locked, changed_fields=["is_active", "suspended"])
    user.refresh_from_db()
    return _user_row(user)


@router.post("/users/{user_id}/reactivate", response=UserRow)
def reactivate_user(request: HttpRequest, user_id: int) -> UserRow:
    user = _target(request, user_id, "reactivate")
    if user.is_staff:
        _permissions_scope(request, user)
    with transaction.atomic():
        locked = User.objects.select_for_update().get(pk=user.pk)
        if locked.is_staff:
            profile = AdminProfile.objects.select_for_update().get(user=locked)
            profile.suspended = False
            profile.save(update_fields=["suspended", "updated_at"])
            revoke_management_sessions(locked.pk)
        locked.is_active = True
        locked.save(update_fields=["is_active"])
        audit_management(request, "user.reactivate", locked, changed_fields=["is_active", "suspended"])
    user.refresh_from_db()
    return _user_row(user)


@router.post("/users/{user_id}/password-reset", response=MessageOut)
def initiate_password_reset(request: HttpRequest, user_id: int) -> MessageOut:
    user = _target(request, user_id, "update")
    require_recent_reauthentication(request)
    send_password_reset(user.email)
    audit_management(request, "user.password_reset_requested", user)
    return MessageOut(message="Password reset instructions sent")


@router.post("/users/{user_id}/grant-administrator", response=UserCreateOut)
def grant_administrator(request: HttpRequest, user_id: int) -> UserCreateOut:
    user = _target(request, user_id, "update")
    actor = _permissions_scope(request, user)
    if user.is_superuser:
        raise HttpError(409, "Account is already a Super Administrator")
    if not user.is_active:
        raise HttpError(409, "Reactivate the account before granting administrator access")
    if user.is_staff:
        raise HttpError(409, "Administrator access is already enabled")
    enrollment_code = None
    with transaction.atomic():
        locked = User.objects.select_for_update().get(pk=user.pk)
        locked.is_staff = True
        locked.save(update_fields=["is_staff"])
        profile, _created = AdminProfile.objects.select_for_update().get_or_create(user=locked)
        profile.suspended = False
        profile.mfa_seed = ""
        profile.mfa_confirmed = False
        profile.enrollment_code_hash = ""
        profile.recovery_code_hashes = []
        profile.individual_actions = []
        profile.save(update_fields=[
            "suspended", "mfa_seed", "mfa_confirmed", "enrollment_code_hash",
            "recovery_code_hashes", "individual_actions", "updated_at",
        ])
        revoke_management_sessions(locked.pk)
        audit_management(request, "user.administrator_granted", locked, ("is_staff",))
        transaction.on_commit(lambda: send_password_reset(locked.email))
    return UserCreateOut(user=_user_row(locked), enrollment_code=enrollment_code)


@router.post("/users/{user_id}/revoke-administrator", response=UserRow)
def revoke_administrator(request: HttpRequest, user_id: int) -> UserRow:
    user = _target(request, user_id, "manage_permissions")
    actor = _permissions_scope(request, user)
    if not user.is_staff:
        raise HttpError(409, "Administrator access is not enabled")
    with transaction.atomic():
        if user.is_superuser:
            _serialize_superuser_status_change()
        locked = User.objects.select_for_update().get(pk=user.pk)
        _protect_last_superuser(locked)
        locked.is_staff = False
        locked.save(update_fields=["is_staff"])
        AdminRoleAssignment.objects.filter(user=locked).delete()
        AdminProfile.objects.filter(user=locked).update(
            suspended=True,
            individual_actions=[],
            session_epoch=F("session_epoch") + 1,
        )
        revoke_management_sessions(locked.pk)
        audit_management(request, "user.administrator_revoked", locked, ("is_staff", "roles", "individual_actions"))
    return _user_row(locked)


@router.get("/roles", response=RoleListOut)
def roles(request: HttpRequest) -> RoleListOut:
    require_management(request, "management", "adminrole", "view")
    from apps.management.role_templates import ensure_default_role_templates

    ensure_default_role_templates()
    queryset = AdminRole.objects.order_by("name")[:100]
    return RoleListOut(items=[_role_row(role) for role in queryset], total=AdminRole.objects.count())


@router.get("/permissions", response=list[PermissionOption])
def permission_options(request: HttpRequest) -> list[PermissionOption]:
    actor = require_management(request, "management", "adminprofile", "manage_permissions")
    options: dict[str, PermissionOption] = {}
    verbs = {
        "view": "مشاهده", "create": "ایجاد", "update": "ویرایش", "delete": "حذف",
        "approve": "تأیید", "reject": "رد", "publish": "انتشار",
        "unpublish": "لغو انتشار", "export": "خروجی",
        "view_sensitive": "مشاهده اطلاعات حساس",
    }
    for spec in RESOURCES:
        app_label, model_name = spec.slug.split(".", 1)
        actions = {"view", "export"}
        if spec.writable_fields:
            actions.add("update")
        if spec.allow_create:
            actions.add("create")
        if spec.allow_delete:
            actions.add("delete")
        if spec.sensitive:
            actions.add("view_sensitive")
        actions.update(action.permission for action in spec.actions)
        for action in actions:
            if not actor.is_superuser and not can_manage(actor, app_label, model_name, action):
                continue
            code = f"{spec.slug}.{action}"
            options[code] = PermissionOption(
                code=code, label=f"{spec.title} · {verbs.get(action, action)}", group=spec.group,
            )
    special = (
        ("management.dashboard.view", "داشبورد · مشاهده", "system"),
        ("management.systemhealth.view", "سلامت سامانه · مشاهده", "system"),
        ("management.adminprofile.manage_permissions", "مدیران · مدیریت مجوز", "security"),
        ("management.adminrole.view", "نقش‌ها · مشاهده", "security"),
        ("management.adminsession.view", "نشست‌ها · مشاهده", "security"),
        ("management.adminsession.revoke_sessions", "نشست‌ها · لغو دسترسی", "security"),
        ("management.adminauditevent.view", "ممیزی · مشاهده", "security"),
        ("accounts.user.suspend", "کاربران · تعلیق", "users"),
        ("accounts.user.reactivate", "کاربران · فعال‌سازی", "users"),
    )
    for code, label, group in special:
        app_label, model_name, action = code.split(".")
        if actor.is_superuser or can_manage(actor, app_label, model_name, action):
            options[code] = PermissionOption(code=code, label=label, group=group)
    return sorted(options.values(), key=lambda item: (item.group, item.label))


@router.get("/groups", response=DjangoGroupListOut)
def list_groups(request: HttpRequest) -> DjangoGroupListOut:
    require_management(request, "auth", "group", "view")
    queryset = Group.objects.prefetch_related("permissions", "user_set").order_by("name")
    return DjangoGroupListOut(items=[_group_row(group) for group in queryset], total=queryset.count())


@router.get("/groups/permissions", response=list[DjangoPermissionOption])
def group_permission_options(request: HttpRequest) -> list[DjangoPermissionOption]:
    actor = require_management(request, "management", "adminprofile", "manage_permissions")
    verb_map = {"view": "view", "add": "create", "change": "update", "delete": "delete"}
    options = []
    queryset = Permission.objects.select_related("content_type").order_by(
        "content_type__app_label", "content_type__model", "codename"
    )
    for permission in queryset:
        verb, separator, _model = permission.codename.partition("_")
        action = verb_map.get(verb) if separator else None
        app_label = permission.content_type.app_label
        model_name = permission.content_type.model
        if action is None or (app_label, model_name) in {
            ("management", "adminauditevent"),
            ("management", "adminsession"),
            ("management", "adminprofile"),
        }:
            continue
        if actor.is_superuser or can_manage(actor, app_label, model_name, action):
            options.append(DjangoPermissionOption(
                id=permission.pk,
                code=f"{app_label}.{permission.codename}",
                label=f"{app_label}.{model_name} · {permission.name}",
                group=app_label,
            ))
    return options


@router.get("/groups/{group_id}", response=DjangoGroupOut)
def get_group(request: HttpRequest, group_id: int) -> DjangoGroupOut:
    require_management(request, "auth", "group", "view")
    group = Group.objects.filter(pk=group_id).first()
    if group is None:
        raise HttpError(404, "Group not found")
    return _group_row(group, include_members=True)


@router.post("/groups", response={201: DjangoGroupOut})
def create_group(request: HttpRequest, payload: DjangoGroupIn):
    actor = _permissions_scope(request)
    name = payload.name.strip()
    if not name or len(name) > 150:
        raise HttpError(400, "Invalid group name")
    if Group.objects.filter(name=name).exists():
        raise HttpError(409, "Group name already exists")
    permissions = _validate_group_permissions(actor, payload.permission_ids)
    with transaction.atomic():
        group = Group.objects.create(name=name)
        group.permissions.set(permissions)
        audit_management(request, "group.create", group, ("name", "permissions"))
    return 201, _group_row(group)


@router.patch("/groups/{group_id}", response=DjangoGroupOut)
def update_group(request: HttpRequest, group_id: int, payload: DjangoGroupIn) -> DjangoGroupOut:
    actor = _permissions_scope(request)
    name = payload.name.strip()
    if not name or len(name) > 150:
        raise HttpError(400, "Invalid group name")
    permissions = _validate_group_permissions(actor, payload.permission_ids)
    with transaction.atomic():
        group = Group.objects.select_for_update().filter(pk=group_id).first()
        if group is None:
            raise HttpError(404, "Group not found")
        if Group.objects.exclude(pk=group.pk).filter(name=name).exists():
            raise HttpError(409, "Group name already exists")
        if not actor.is_superuser:
            current_ids = list(group.permissions.values_list("id", flat=True))
            _validate_group_permissions(actor, current_ids)
        group.name = name
        group.save(update_fields=["name"])
        group.permissions.set(permissions)
        audit_management(request, "group.update", group, ("name", "permissions"))
    return _group_row(group, include_members=True)


@router.delete("/groups/{group_id}", response=MessageOut)
def delete_group(request: HttpRequest, group_id: int) -> MessageOut:
    actor = _permissions_scope(request)
    with transaction.atomic():
        group = Group.objects.select_for_update().filter(pk=group_id).first()
        if group is None:
            raise HttpError(404, "Group not found")
        if not actor.is_superuser:
            _validate_group_permissions(actor, list(group.permissions.values_list("id", flat=True)))
        group.delete()
        audit_management(request, "group.delete", group)
    return MessageOut(message="Group deleted")


@router.put("/groups/{group_id}/members", response=DjangoGroupOut)
def set_group_members(
    request: HttpRequest, group_id: int, payload: GroupMembersIn
) -> DjangoGroupOut:
    actor = _permissions_scope(request)
    if len(payload.user_ids) > 500 or len(set(payload.user_ids)) != len(payload.user_ids):
        raise HttpError(400, "Invalid group member list")
    with transaction.atomic():
        group = Group.objects.select_for_update().filter(pk=group_id).first()
        if group is None:
            raise HttpError(404, "Group not found")
        if group.user_set.count() > 500:
            raise HttpError(
                409,
                "Group has more than 500 members; membership changes are disabled to prevent data loss",
            )
        if not actor.is_superuser:
            _validate_group_permissions(actor, list(group.permissions.values_list("id", flat=True)))
        existing_ids = set(group.user_set.values_list("pk", flat=True))
        target_ids = existing_ids | set(payload.user_ids)
        users = list(
            User.objects.select_for_update()
            .filter(pk__in=target_ids)
            .prefetch_related("groups", "management_roles")
        )
        if len(users) != len(target_ids):
            raise HttpError(400, "Unknown group member")
        for user in users:
            require_management(request, "accounts", "user", "update", obj=user)
            if user.is_superuser and not actor.is_superuser:
                raise HttpError(403, "Protected administrator")
        group.user_set.set([user for user in users if user.pk in payload.user_ids])
        audit_management(request, "group.members_changed", group, ("members",))
    return _group_row(group, include_members=True)


@router.post("/roles", response={201: RoleOut})
def create_role(request: HttpRequest, payload: RoleIn):
    actor = _permissions_scope(request)
    codes = _validate_codes(actor, payload.action_codes)
    name = payload.name.strip()
    if not 1 <= len(name) <= 120:
        raise HttpError(400, "Invalid role name")
    role = AdminRole.objects.create(name=name, description=payload.description.strip()[:300], action_codes=codes, is_active=payload.is_active)
    audit_management(request, "role.create", role, changed_fields=["name", "action_codes", "is_active"])
    return 201, _role_row(role)


@router.patch("/roles/{role_id}", response=RoleOut)
def update_role(request: HttpRequest, role_id: int, payload: RoleIn) -> RoleOut:
    actor = _permissions_scope(request)
    with transaction.atomic():
        role = AdminRole.objects.select_for_update().filter(pk=role_id).first()
        if role is None:
            raise HttpError(404, "Role not found")
        if not actor.is_superuser:
            _validate_codes(actor, list(role.action_codes))
            if role.assignments.filter(user__is_superuser=True).exists():
                raise HttpError(403, "Protected administrator")
        role.name = payload.name.strip()[:120]
        role.description = payload.description.strip()[:300]
        role.action_codes = _validate_codes(actor, payload.action_codes)
        role.is_active = payload.is_active
        role.full_clean()
        role.save()
        audit_management(request, "role.update", role, changed_fields=["name", "description", "action_codes", "is_active"])
    return _role_row(role)


@router.post("/roles/{role_id}/duplicate", response={201: RoleOut})
def duplicate_role(request: HttpRequest, role_id: int):
    actor = _permissions_scope(request)
    source = AdminRole.objects.filter(pk=role_id).first()
    if source is None:
        raise HttpError(404, "Role not found")
    if not actor.is_superuser:
        _validate_codes(actor, list(source.action_codes))
    base_name = f"کپی {source.name}"[:120]
    name = base_name
    suffix = 2
    while AdminRole.objects.filter(name=name).exists():
        name = f"{base_name} ({suffix})"[:120]
        suffix += 1
    role = AdminRole.objects.create(
        name=name,
        description=source.description,
        action_codes=list(source.action_codes),
        is_active=source.is_active,
    )
    audit_management(request, "role.duplicate", role, changed_fields=["name", "action_codes", "source_role"])
    return 201, _role_row(role)


@router.put("/users/{user_id}/roles", response=UserRow)
def assign_roles(request: HttpRequest, user_id: int, payload: RoleAssignmentsIn) -> UserRow:
    user = _target(request, user_id)
    actor = _permissions_scope(request, user)
    if not user.is_staff:
        raise HttpError(400, "Administrator account required")
    role_ids = set(payload.role_ids)
    if len(role_ids) > 100:
        raise HttpError(400, "Too many roles")
    roles = list(AdminRole.objects.filter(pk__in=role_ids, is_active=True))
    if len(roles) != len(role_ids):
        raise HttpError(400, "Invalid role selection")
    if not actor.is_superuser:
        for role in roles:
            _validate_codes(actor, list(role.action_codes))
    with transaction.atomic():
        current = set(AdminRoleAssignment.objects.filter(user=user).values_list("role_id", flat=True))
        AdminRoleAssignment.objects.filter(user=user, role_id__in=current-role_ids).delete()
        AdminRoleAssignment.objects.bulk_create(
            [AdminRoleAssignment(user=user, role_id=role_id) for role_id in role_ids-current]
        )
        revoke_management_sessions(user.pk)
        audit_management(request, "user.roles_changed", user, changed_fields=["roles"])
    user = _target(request, user_id)
    return _user_row(user)


@router.put("/users/{user_id}/permissions", response=UserRow)
def assign_permissions(request: HttpRequest, user_id: int, payload: IndividualPermissionsIn) -> UserRow:
    user = _target(request, user_id)
    actor = _permissions_scope(request, user)
    codes = _validate_codes(actor, payload.action_codes)
    if not user.is_staff:
        raise HttpError(400, "Administrator account required")
    profile = AdminProfile.objects.get(user=user)
    if not actor.is_superuser:
        _validate_codes(actor, list(profile.individual_actions))
    profile.individual_actions = codes
    profile.save(update_fields=["individual_actions", "updated_at"])
    revoke_management_sessions(user.pk)
    audit_management(request, "user.permissions_changed", user, changed_fields=["individual_actions"])
    return _user_row(user)


@router.get("/users/{user_id}/object-grants", response=ObjectGrantListOut)
def object_grants(request: HttpRequest, user_id: int, limit: int = 25, offset: int = 0) -> ObjectGrantListOut:
    user = _target(request, user_id)
    actor = require_management(request, "management", "adminprofile", "manage_permissions")
    if user.is_superuser and not actor.is_superuser:
        raise HttpError(403, "Protected administrator")
    limit, offset = _page(limit, offset)
    queryset = AdminObjectGrant.objects.select_related("content_type").filter(user=user).order_by("id")
    total = queryset.count()
    return ObjectGrantListOut(
        items=[_object_grant_row(grant) for grant in queryset[offset:offset+limit]],
        total=total, limit=limit, offset=offset,
    )


def _grant_target(app_label: str, model_name: str, object_id: str):  # type: ignore[no-untyped-def]
    if len(object_id) > 100:
        raise HttpError(400, "Invalid object identifier")
    try:
        model = apps.get_model(app_label, model_name)
        obj = model._default_manager.filter(pk=object_id).first()
    except (LookupError, ValueError, ValidationError) as exc:
        raise HttpError(404, "Target not found") from exc
    if obj is None or (app_label, model_name) in {
        ("management", "adminauditevent"), ("management", "adminsession")
    }:
        raise HttpError(404, "Target not found")
    return obj


@router.put("/users/{user_id}/object-grants/{app_label}/{model_name}/{object_id}", response=ObjectGrantOut)
def set_object_grant(
    request: HttpRequest, user_id: int, app_label: str, model_name: str,
    object_id: str, payload: ObjectGrantIn,
) -> ObjectGrantOut:
    user = _target(request, user_id)
    actor = _permissions_scope(request, user)
    if not user.is_staff or len(payload.actions) > 20 or len(set(payload.actions)) != len(payload.actions):
        raise HttpError(400, "Invalid object grant")
    obj = _grant_target(app_label, model_name, object_id)
    if app_label == "accounts" and model_name == "user" and obj.is_superuser and not actor.is_superuser:
        raise HttpError(403, "Protected administrator")
    if not payload.actions:
        raise HttpError(400, "At least one action is required; use DELETE to revoke")
    _validate_codes(actor, [f"{app_label}.{model_name}.{action}" for action in payload.actions])
    for action in payload.actions:
        if not actor.is_superuser and not can_manage(actor, app_label, model_name, action, obj=obj):
            raise HttpError(403, "Grant exceeds your object scope")
    content_type = ContentType.objects.get_for_model(obj)
    with transaction.atomic():
        grant, _ = AdminObjectGrant.objects.update_or_create(
            user=user, content_type=content_type, object_id=str(obj.pk),
            defaults={"actions": sorted(payload.actions)},
        )
        audit_management(request, "permission.object_grant", user, changed_fields=["object_grants"])
    return _object_grant_row(grant)


@router.delete("/users/{user_id}/object-grants/{app_label}/{model_name}/{object_id}", response=MessageOut)
def revoke_object_grant(
    request: HttpRequest, user_id: int, app_label: str, model_name: str, object_id: str,
) -> MessageOut:
    user = _target(request, user_id)
    actor = _permissions_scope(request, user)
    grant = AdminObjectGrant.objects.filter(
        user=user, content_type__app_label=app_label,
        content_type__model=model_name, object_id=object_id,
    ).first()
    if grant is None:
        raise HttpError(404, "Grant not found")
    if not actor.is_superuser:
        obj = _grant_target(app_label, model_name, object_id)
        if not all(can_manage(actor, app_label, model_name, action, obj=obj) for action in grant.actions):
            raise HttpError(403, "Grant exceeds your scope")
    grant.delete()
    audit_management(request, "permission.object_grant_revoked", user, changed_fields=["object_grants"])
    return MessageOut(message="Object grant revoked")


@router.get("/users/{user_id}/sessions", response=SessionListOut)
def sessions(request: HttpRequest, user_id: int) -> SessionListOut:
    user = _target(request, user_id)
    actor = require_management(request, "management", "adminsession", "view")
    if actor.pk != user.pk and not can_manage(actor, "management", "adminsession", "revoke_sessions"):
        raise HttpError(403, "Permission denied")
    items = AdminSession.objects.filter(user=user).order_by("-created_at")[:50]
    return SessionListOut(items=[SessionOut.model_validate({
        "id": item.pk, "created_at": item.created_at, "last_seen_at": item.last_seen_at,
        "expires_at": item.expires_at, "revoked_at": item.revoked_at,
        "ip_address": item.ip_address, "user_agent": item.user_agent,
    }) for item in items])


@router.post("/users/{user_id}/sessions/revoke", response=MessageOut)
def revoke_sessions(request: HttpRequest, user_id: int) -> MessageOut:
    user = _target(request, user_id)
    actor = require_management(request, "management", "adminsession", "revoke_sessions")
    if user.is_superuser and not actor.is_superuser:
        raise HttpError(403, "Protected administrator")
    require_recent_reauthentication(request)
    revoke_management_sessions(user.pk)
    audit_management(request, "user.sessions_revoked", user)
    return MessageOut(message="Sessions revoked")


@router.get("/audit", response=AuditListOut)
def audit_events(request: HttpRequest, limit: int = 25, offset: int = 0, action: str = "") -> AuditListOut:
    require_management(request, "management", "adminauditevent", "view")
    limit, offset = _page(limit, offset)
    queryset = AdminAuditEvent.objects.all()
    if action:
        queryset = queryset.filter(action=action[:100])
    total = queryset.count()
    items = queryset[offset:offset+limit]
    audit_management(request, "audit.view")
    return AuditListOut(items=[AuditOut.model_validate({
        "id": event.pk, "actor_id": event.actor_id,
        "action": event.action, "target_app": event.target_app,
        "target_model": event.target_model, "target_id": event.target_id,
        "result": event.result, "request_id": event.request_id,
        "ip_address": event.ip_address, "user_agent": event.user_agent,
        "safe_changes": event.safe_changes, "created_at": event.created_at,
    }) for event in items], total=total, limit=limit, offset=offset)
