"""Explicit, secret-free operational health response."""

from datetime import datetime
from typing import Literal

from ninja import Schema


class ComponentHealth(Schema):
    status: Literal["ok", "error", "unknown", "stale"]
    detail: str | None = None


class SystemHealthOut(Schema):
    checked_at: datetime
    database: ComponentHealth
    redis: ComponentHealth
    celery_workers: ComponentHealth
    celery_beat: ComponentHealth
    database_bytes: int | None = None
    storage_used_bytes: int | None = None
    storage_total_bytes: int | None = None
    completed_tasks_24h: int | None = None
    failed_tasks_24h: int | None = None
    api_p95_ms: float | None = None
