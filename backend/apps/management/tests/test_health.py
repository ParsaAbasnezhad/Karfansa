"""Operational counters report observed state and never include task payloads."""

from datetime import timedelta

from django.core.cache import cache
from django.utils import timezone

from apps.management.api.health import _beat_health, _task_statistics
from apps.management.tasks import BEAT_HEARTBEAT_CACHE_KEY, record_task_result


def test_task_outcome_counts_are_bounded_and_anonymous() -> None:
    cache.clear()
    record_task_result(state="SUCCESS", args=("private-value",))
    record_task_result(state="SUCCESS")
    record_task_result(state="FAILURE", exception=ValueError("private-value"))
    record_task_result(state="RETRY")

    assert _task_statistics(True) == (2, 1)  # noqa: S101
    assert _task_statistics(False) == (None, None)  # noqa: S101


def test_beat_health_reflects_observed_heartbeat() -> None:
    cache.clear()
    now = timezone.now()
    assert _beat_health(now, False)["status"] == "unknown"  # noqa: S101
    assert _beat_health(now, True)["status"] == "unknown"  # noqa: S101

    cache.set(BEAT_HEARTBEAT_CACHE_KEY, now.isoformat())
    assert _beat_health(now, True)["status"] == "ok"  # noqa: S101

    cache.set(BEAT_HEARTBEAT_CACHE_KEY, (now - timedelta(minutes=4)).isoformat())
    assert _beat_health(now, True)["status"] == "stale"  # noqa: S101
