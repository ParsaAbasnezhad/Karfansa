"""Server-side authorization for the independent management session."""

import hashlib
import time

from django.conf import settings
from django.apps import apps
from django.db.models import QuerySet
from django.http import HttpRequest
from django.utils import timezone
from ninja.errors import HttpError

from .models import AdminObjectGrant, AdminSession


DJANGO_ACTIONS = {"view": "view", "create": "add", "update": "change", "delete": "delete"}
MANAGEMENT_ACTIONS = {
    "view", "create", "update", "delete", "approve", "reject", "publish",
    "unpublish", "export", "manage_permissions", "suspend", "reactivate",
    "view_sensitive", "revoke_sessions",
}


def _session_digest(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


def management_actor(request: HttpRequest):  # type: ignore[no-untyped-def]
    """Validate the isolated cookie and revocation index on every request."""
    cached = getattr(request, "_validated_management_actor", None)
    if cached is not None:
        return cached
    session = getattr(request, "management_session", None)
    if session is None or not session.session_key:
        raise HttpError(401, "Administrative sign in required")
    user_id = session.get("management_user_id")
    if not user_id:
        raise HttpError(401, "Administrative sign in required")
    now = timezone.now()
    record = (
        AdminSession.objects.select_related("user", "user__management_profile")
        .filter(key_digest=_session_digest(session.session_key), user_id=user_id)
        .first()
    )
    if record is None or record.revoked_at or record.expires_at <= now:
        session.flush()
        raise HttpError(401, "Administrative session expired")
    user = record.user
    profile = getattr(user, "management_profile", None)
    if (
        not user.is_active or not user.is_staff or profile is None
        or profile.suspended
        or session.get("management_epoch") != profile.session_epoch
    ):
        record.revoked_at = now
        record.save(update_fields=["revoked_at"])
        session.flush()
        raise HttpError(401, "Administrative session expired")
    if (now - record.last_seen_at).total_seconds() > settings.MANAGEMENT_INACTIVITY_SECONDS:
        record.revoked_at = now
        record.save(update_fields=["revoked_at"])
        session.flush()
        raise HttpError(401, "Administrative session expired")
    if (now - record.last_seen_at).total_seconds() >= 60:
        record.last_seen_at = now
        record.save(update_fields=["last_seen_at"])
        session["management_epoch"] = profile.session_epoch
    request.management_actor = user  # type: ignore[attr-defined]
    request._validated_management_actor = user  # type: ignore[attr-defined]
    return user


def action_code(app_label: str, model_name: str, action: str) -> str:
    return f"{app_label.lower()}.{model_name.lower()}.{action}"


def effective_action_codes(user) -> set[str]:  # type: ignore[no-untyped-def]
    profile = getattr(user, "management_profile", None)
    codes = set(profile.individual_actions if profile else [])
    for assignment in user.management_roles.select_related("role").all():
        if assignment.role.is_active:
            codes.update(assignment.role.action_codes)
    return codes


def can_manage(user, app_label: str, model_name: str, action: str, obj=None) -> bool:  # type: ignore[no-untyped-def]
    if action not in MANAGEMENT_ACTIONS or not user.is_active or not user.is_staff:
        return False
    profile = getattr(user, "management_profile", None)
    if profile is None or profile.suspended:
        return False
    if user.is_superuser:
        return True
    app_label, model_name = app_label.lower(), model_name.lower()
    code = action_code(app_label, model_name, action)
    allowed = code in effective_action_codes(user)
    if action in DJANGO_ACTIONS:
        permission = f"{app_label}.{DJANGO_ACTIONS[action]}_{model_name}"
        allowed = allowed or user.has_perm(permission)
    if not allowed:
        return False
    if obj is not None:
        model = apps.get_model(app_label, model_name, require_ready=False)
        grants = AdminObjectGrant.objects.filter(
            user=user, content_type__app_label=app_label,
            content_type__model=model._meta.model_name,
        )
        if grants.exists():
            grant = grants.filter(object_id=str(obj.pk)).first()
            return grant is not None and action in grant.actions
    return True


def require_management(
    request: HttpRequest, app_label: str, model_name: str, action: str = "view", obj=None
):  # type: ignore[no-untyped-def]
    actor = management_actor(request)
    if not can_manage(actor, app_label, model_name, action, obj=obj):
        raise HttpError(403, "Administrative permission denied")
    return actor


def require_recent_reauthentication(request: HttpRequest, max_age_seconds: int = 300) -> None:
    management_actor(request)
    session = request.management_session  # type: ignore[attr-defined]
    checked_at = session.get("management_reauthenticated_at", 0)
    if not isinstance(checked_at, int) or time.time() - checked_at > max_age_seconds:
        raise HttpError(403, "Reauthentication required")


def scope_queryset(request: HttpRequest, queryset: QuerySet) -> QuerySet:
    """Apply object grant allowlists to management list endpoints."""
    actor = management_actor(request)
    if actor.is_superuser:
        return queryset
    model = queryset.model
    grants = AdminObjectGrant.objects.filter(
        user=actor,
        content_type__app_label=model._meta.app_label,
        content_type__model=model._meta.model_name,
    )
    if not grants.exists():
        return queryset
    return queryset.filter(
        pk__in=grants.filter(actions__contains=["view"]).values_list("object_id", flat=True)
    )
