"""Bounded, anonymous Celery health counters and Beat heartbeat."""

import logging
from datetime import timedelta

from celery import shared_task
from celery.signals import task_postrun
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

BEAT_HEARTBEAT_CACHE_KEY = "management:beat:last_seen"
BEAT_HEARTBEAT_TTL_SECONDS = 240
TASK_COUNTER_TTL_SECONDS = 26 * 3600
logger = logging.getLogger(__name__)


def _counter_key(state: str, hour: str) -> str:
    return f"management:tasks:{state}:{hour}"


@task_postrun.connect
def record_task_result(state: str | None = None, **_kwargs: object) -> None:
    """Store aggregate outcomes without task names, arguments or exception data."""
    if state not in {"SUCCESS", "FAILURE"}:
        return
    key = _counter_key(state, timezone.now().strftime("%Y%m%d%H"))
    try:
        cache.add(key, 0, timeout=TASK_COUNTER_TTL_SECONDS)
        cache.incr(key)
    except Exception:
        # Monitoring must never change a business task's result.
        logger.warning("Celery outcome counter unavailable")


def task_outcomes_24h() -> tuple[int, int]:
    now = timezone.now()
    hours = [(now - timedelta(hours=offset)).strftime("%Y%m%d%H") for offset in range(24)]
    keys = [_counter_key(state, hour) for state in ("SUCCESS", "FAILURE") for hour in hours]
    values = cache.get_many(keys)
    completed = sum(int(values.get(_counter_key("SUCCESS", hour), 0)) for hour in hours)
    failed = sum(int(values.get(_counter_key("FAILURE", hour), 0)) for hour in hours)
    return completed, failed


@shared_task(name="apps.management.beat_heartbeat", ignore_result=True)
def beat_heartbeat() -> None:
    cache.set(
        BEAT_HEARTBEAT_CACHE_KEY,
        timezone.now().isoformat(),
        timeout=BEAT_HEARTBEAT_TTL_SECONDS,
    )


@shared_task(name="apps.management.publish_scheduled_opportunities", ignore_result=True)
def publish_scheduled_opportunities() -> int:
    """Publish at most 100 approved opportunities due now, with row locks."""
    from apps.management.models import AdminAuditEvent
    from apps.trade.models import OpportunityReviewStatus, TradeOpportunity

    now = timezone.now()
    today = timezone.localdate()
    published = 0
    with transaction.atomic():
        due = (
            TradeOpportunity.objects.select_for_update(skip_locked=True)
            .filter(
                review_status=OpportunityReviewStatus.APPROVED,
                is_published=False,
                scheduled_for__lte=now,
            )
            .filter(Q(valid_until__isnull=True) | Q(valid_until__gte=today))
            .order_by("scheduled_for", "pk")[:100]
        )
        for opportunity in due:
            opportunity.is_published = True
            opportunity.published_at = now
            try:
                opportunity.full_clean()
                opportunity.save(update_fields=["is_published", "published_at", "updated_at"])
            except ValidationError:
                opportunity.is_published = False
                opportunity.published_at = None
                opportunity.scheduled_for = None
                opportunity.save(update_fields=["scheduled_for", "updated_at"])
                result = "failure"
            else:
                published += 1
                result = "success"
            AdminAuditEvent.objects.create(
                action="trade.scheduled_publication",
                target_app="trade",
                target_model="tradeopportunity",
                target_id=str(opportunity.pk),
                result=result,
            )
    return published
