"""Authorized, bounded operational checks for the control center."""

import logging
import shutil
from datetime import datetime

from celery import current_app
from django.conf import settings
from django.core.cache import cache
from django.db import connection
from django.http import HttpRequest
from django.utils import timezone
from django.views.decorators.cache import never_cache
from ninja import Router
from ninja.decorators import decorate_view

from apps.core.health import check_database, check_redis
from apps.management.permissions import require_management
from apps.management.schemas.health import SystemHealthOut
from apps.management.tasks import BEAT_HEARTBEAT_CACHE_KEY, task_outcomes_24h

logger = logging.getLogger(__name__)
router = Router()


def _database_bytes() -> int | None:
    if connection.vendor != "postgresql":
        return None
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT pg_database_size(current_database())")
            row = cursor.fetchone()
        return int(row[0]) if row else None
    except Exception:
        logger.exception("Management database size check failed")
        return None


def _storage_usage() -> tuple[int | None, int | None]:
    try:
        usage = shutil.disk_usage(settings.MEDIA_ROOT.parent)
        return usage.used, usage.total
    except OSError:
        logger.exception("Management storage usage check failed")
        return None, None


def _worker_health() -> dict[str, str | None]:
    try:
        inspectors = current_app.control.inspect(timeout=1.0)
        workers = inspectors.ping() if inspectors else None
        if not workers:
            return {"status": "error", "detail": "No worker responded"}
        return {"status": "ok", "detail": f"{len(workers)} worker(s) responding"}
    except Exception:
        logger.exception("Management Celery worker check failed")
        return {"status": "unknown", "detail": "Worker status unavailable"}


def _beat_health(now: datetime, redis_ok: bool) -> dict[str, str | None]:
    if not redis_ok:
        return {"status": "unknown", "detail": "Redis unavailable"}
    try:
        raw = cache.get(BEAT_HEARTBEAT_CACHE_KEY)
        if not isinstance(raw, str):
            return {"status": "unknown", "detail": "No heartbeat observed"}
        last_seen = datetime.fromisoformat(raw)
        age = (now - last_seen).total_seconds()
        return {
            "status": "ok" if 0 <= age <= 180 else "stale",
            "detail": "Recent scheduled task observed" if 0 <= age <= 180 else "Heartbeat delayed",
        }
    except (ValueError, TypeError):
        return {"status": "unknown", "detail": "Heartbeat unreadable"}
    except Exception:
        logger.exception("Management Celery Beat check failed")
        return {"status": "unknown", "detail": "Heartbeat unavailable"}


def _task_statistics(redis_ok: bool) -> tuple[int | None, int | None]:
    if not redis_ok:
        return None, None
    try:
        return task_outcomes_24h()
    except Exception:
        logger.exception("Management task statistics check failed")
        return None, None


@router.get("/", response=SystemHealthOut, operation_id="management_system_health")
@decorate_view(never_cache)
def system_health(request: HttpRequest) -> dict[str, object]:
    require_management(request, "management", "systemhealth", "view")
    now = timezone.now()
    database_ok = check_database().ok
    redis_ok = check_redis().ok
    used, total = _storage_usage()
    completed, failed = _task_statistics(redis_ok)
    return {
        "checked_at": now,
        "database": {"status": "ok" if database_ok else "error"},
        "redis": {"status": "ok" if redis_ok else "error"},
        "celery_workers": _worker_health(),
        "celery_beat": _beat_health(now, redis_ok),
        "database_bytes": _database_bytes() if database_ok else None,
        "storage_used_bytes": used,
        "storage_total_bytes": total,
        "completed_tasks_24h": completed,
        "failed_tasks_24h": failed,
        # No latency aggregator exists yet; null is truthful.
        "api_p95_ms": None,
    }
