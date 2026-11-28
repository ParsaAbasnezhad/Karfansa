"""Safe, append-only management audit events."""

import re
import uuid
from collections.abc import Iterable
from typing import Any

from django.conf import settings
from django.http import HttpRequest

from .models import AdminAuditEvent


_FIELD = re.compile(r"^[a-zA-Z][a-zA-Z0-9_]{0,63}$")
_FORBIDDEN = ("password", "secret", "token", "otp", "code", "credential", "hash")


def client_ip(request: HttpRequest) -> str | None:
    remote = request.META.get("REMOTE_ADDR", "")
    if remote in settings.MANAGEMENT_TRUSTED_PROXY_IPS:
        forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
        if forwarded:
            return forwarded.split(",", 1)[0].strip() or None
    return remote or None


def audit_management(
    request: HttpRequest,
    action: str,
    obj: Any = None,
    changed_fields: Iterable[str] = (),
    result: str = "success",
) -> AdminAuditEvent:
    safe_fields = sorted(
        {
            field
            for field in changed_fields
            if _FIELD.fullmatch(field) and not any(term in field.lower() for term in _FORBIDDEN)
        }
    )
    meta = getattr(obj, "_meta", None)
    supplied_request_id = request.META.get("HTTP_X_REQUEST_ID", "")
    request_id = (
        supplied_request_id
        if re.fullmatch(r"[A-Za-z0-9_-]{1,64}", supplied_request_id)
        else uuid.uuid4().hex
    )
    return AdminAuditEvent.objects.create(
        actor=getattr(request, "management_actor", None),
        action=action[:100],
        target_app=getattr(meta, "app_label", "")[:100],
        target_model=getattr(meta, "model_name", "")[:100],
        target_id=str(getattr(obj, "pk", "") or "")[:100],
        result=result[:24],
        request_id=request_id,
        ip_address=client_ip(request),
        user_agent=request.META.get("HTTP_USER_AGENT", "")[:300],
        safe_changes={"changed_fields": safe_fields},
    )
