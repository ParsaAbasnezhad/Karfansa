"""Configurable default role templates for the Control Center.

Templates are seeded as ordinary AdminRole rows. Authorization always evaluates
the stored action_codes (plus Django permissions and object grants) — never
role names. Super Administrator authority remains Django is_superuser.
"""

from __future__ import annotations

from dataclasses import dataclass

from django.db import transaction

from apps.management.models import AdminRole
from apps.management.resources.registry import RESOURCES


@dataclass(frozen=True)
class RoleTemplate:
    name: str
    description: str
    groups: tuple[str, ...]
    actions: tuple[str, ...]
    include_special: tuple[str, ...] = ()


def _resource_codes(groups: set[str], actions: set[str]) -> list[str]:
    codes: list[str] = []
    for spec in RESOURCES:
        if spec.group not in groups:
            continue
        available = {"view", "export"}
        if spec.writable_fields:
            available.add("update")
        if spec.allow_create:
            available.add("create")
        if spec.allow_delete:
            available.add("delete")
        if spec.sensitive:
            available.add("view_sensitive")
        available.update(action.permission for action in spec.actions)
        for action in sorted(available & actions):
            codes.append(f"{spec.slug}.{action}")
    return codes


SPECIAL_ALL = (
    "management.dashboard.view",
    "management.systemhealth.view",
    "management.adminprofile.manage_permissions",
    "management.adminrole.view",
    "management.adminsession.view",
    "management.adminsession.revoke_sessions",
    "management.adminauditevent.view",
    "accounts.user.suspend",
    "accounts.user.reactivate",
)

ALL_GROUPS = tuple(sorted({spec.group for spec in RESOURCES}))
ALL_ACTIONS = (
    "view", "create", "update", "delete", "approve", "reject", "publish",
    "unpublish", "export", "view_sensitive", "suspend", "reactivate",
    "manage_permissions", "revoke_sessions",
)

ROLE_TEMPLATES: tuple[RoleTemplate, ...] = (
    RoleTemplate(
        name="مدیر ارشد سامانه",
        description="الگوی کامل دسترسی‌های مدیریتی (مرجع؛ اختیار واقعی مدیر ارشد همچنان is_superuser است).",
        groups=ALL_GROUPS,
        actions=ALL_ACTIONS,
        include_special=SPECIAL_ALL,
    ),
    RoleTemplate(
        name="مدیر اجرایی",
        description="نظارت عملیاتی بر کاربران، سازمان‌ها، محصولات، فرصت‌ها و پشتیبانی.",
        groups=(
            "users", "organizations", "services", "trade", "support",
            "inquiries", "analytics", "audit", "system",
        ),
        actions=(
            "view", "update", "approve", "reject", "publish", "unpublish",
            "export", "view_sensitive", "suspend", "reactivate",
        ),
        include_special=(
            "management.dashboard.view",
            "management.systemhealth.view",
            "management.adminauditevent.view",
            "accounts.user.suspend",
            "accounts.user.reactivate",
        ),
    ),
    RoleTemplate(
        name="تیم پشتیبانی",
        description="پاسخ‌گویی به تیکت‌ها، پیام‌های تماس و پیگیری اهداف کاربران.",
        groups=("support", "inquiries", "analytics", "users"),
        actions=("view", "update", "export", "view_sensitive"),
        include_special=("management.dashboard.view",),
    ),
    RoleTemplate(
        name="مدیر محتوا",
        description="مدیریت اسلایدر، درباره ما، تبلیغات، گزارش‌ها و نویسندگان.",
        groups=("content", "analysis", "geography"),
        actions=("view", "create", "update", "delete", "publish", "unpublish", "export"),
        include_special=("management.dashboard.view",),
    ),
    RoleTemplate(
        name="مدیر کسب‌وکار",
        description="مدیریت شرکت‌ها، فعالان فردی، محصولات، فرصت‌های تجاری و حمل‌ونقل.",
        groups=("organizations", "services", "trade", "transportation", "inquiries"),
        actions=(
            "view", "update", "approve", "reject", "publish", "unpublish",
            "export", "view_sensitive",
        ),
        include_special=("management.dashboard.view",),
    ),
    RoleTemplate(
        name="ناظر محتوا",
        description="بررسی و تصمیم‌گیری روی صف تأیید محتوا بدون دسترسی حساس امنیتی.",
        groups=("organizations", "services", "trade", "content", "analysis"),
        actions=("view", "approve", "reject", "publish", "unpublish", "export"),
        include_special=("management.dashboard.view",),
    ),
    RoleTemplate(
        name="حسابرس فقط‌خواندنی",
        description="مشاهده و خروجی گزارش‌ها و ممیزی بدون تغییر داده‌ها.",
        groups=ALL_GROUPS,
        actions=("view", "export", "view_sensitive"),
        include_special=(
            "management.dashboard.view",
            "management.systemhealth.view",
            "management.adminauditevent.view",
        ),
    ),
)


def template_action_codes(template: RoleTemplate) -> list[str]:
    codes = _resource_codes(set(template.groups), set(template.actions))
    codes.extend(template.include_special)
    # Preserve order while unique.
    return list(dict.fromkeys(codes))


@transaction.atomic
def ensure_default_role_templates() -> list[AdminRole]:
    """Create missing default templates; never overwrite edited roles."""
    created: list[AdminRole] = []
    for template in ROLE_TEMPLATES:
        role, was_created = AdminRole.objects.get_or_create(
            name=template.name,
            defaults={
                "description": template.description[:300],
                "action_codes": template_action_codes(template),
                "is_active": True,
            },
        )
        if was_created:
            created.append(role)
    return created
