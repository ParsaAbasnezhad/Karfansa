"""Dependency checks used by the readiness endpoint."""

import logging
from dataclasses import dataclass

import redis
from django.conf import settings
from django.db import connection

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class CheckResult:
    name: str
    ok: bool


def check_database() -> CheckResult:
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
    except Exception:
        logger.exception("Database readiness check failed")
        return CheckResult("database", ok=False)
    return CheckResult("database", ok=True)


def check_redis() -> CheckResult:
    try:
        client = redis.Redis.from_url(
            f"{settings.REDIS_URL}/0", socket_connect_timeout=2, socket_timeout=2
        )
        client.ping()
    except Exception:
        logger.exception("Redis readiness check failed")
        return CheckResult("redis", ok=False)
    return CheckResult("redis", ok=True)


def run_checks() -> list[CheckResult]:
    return [check_database(), check_redis()]
