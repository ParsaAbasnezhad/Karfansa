from typing import Any

from django.db import models

from apps.accounts.models import User

from .models import BusinessAuditLog


def audit(
    actor: User | None,
    action: str,
    target: models.Model,
    **metadata: Any,
) -> None:
    blocked = {"password", "code", "token", "file", "national_id", "economic_code"}
    safe = {key: value for key, value in metadata.items() if key not in blocked}
    BusinessAuditLog.objects.create(
        actor=actor if actor and actor.is_authenticated else None,
        action=action[:64],
        target_type=target._meta.label[:80],
        target_id=str(target.pk)[:36],
        metadata=safe,
    )
