"""Executive dashboard backed by bounded database aggregations."""

from collections import defaultdict
from datetime import date, timedelta
from typing import Any

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db.models import Count, Q
from django.db.models.functions import TruncDate
from django.http import HttpRequest
from django.utils import timezone
from django.utils.dateparse import parse_date
from ninja import Router
from ninja.errors import HttpError

from apps.core.verification import VerificationStatus
from apps.intents.models import IntentGoal, UserIntent
from apps.management.models import AdminAuditEvent, AdminSession
from apps.management.permissions import can_manage, require_management
from apps.organizations.models import Organization, VerificationDocument
from apps.services.models import ProductInquiry, ProductListing, SellerProfile
from apps.support.models import SupportTicket, TicketStatus
from apps.trade.models import OpportunityReviewStatus, TradeOpportunity


router = Router()
_ALLOWED_DAYS = {7, 30, 90, 365}


def _range(request: HttpRequest) -> tuple[date, date]:
    today = timezone.localdate()
    from_raw = request.GET.get("from_date")
    to_raw = request.GET.get("to_date")
    if from_raw or to_raw:
        if not from_raw or not to_raw:
            raise HttpError(400, "Both custom range dates are required")
        start = parse_date(from_raw)
        end = parse_date(to_raw)
        if start is None or end is None or start > end or end > today or (end - start).days > 365:
            raise HttpError(400, "Invalid date range")
        return start, end
    try:
        days = int(request.GET.get("days", "30"))
    except ValueError as exc:
        raise HttpError(400, "Invalid date range") from exc
    if days not in _ALLOWED_DAYS:
        raise HttpError(400, "Invalid date range")
    return today - timedelta(days=days - 1), today


def _daily(queryset: Any, field: str, start: date, end: date) -> list[dict[str, Any]]:
    rows = (
        queryset.filter(**{f"{field}__date__gte": start, f"{field}__date__lte": end})
        .annotate(day=TruncDate(field))
        .values("day")
        .annotate(count=Count("pk"))
        .order_by("day")
    )
    counts = {row["day"]: row["count"] for row in rows if row["day"]}
    return [
        {"date": (start + timedelta(days=offset)).isoformat(),
         "count": counts.get(start + timedelta(days=offset), 0)}
        for offset in range((end - start).days + 1)
    ]


def _distribution(queryset: Any, field: str, limit: int = 12) -> list[dict[str, Any]]:
    rows = queryset.values(field).annotate(count=Count("pk")).order_by("-count", field)[:limit]
    return [{"label": str(row[field] or "نامشخص"), "count": row["count"]} for row in rows]


def _build(start: date, end: date) -> dict[str, Any]:
    User = get_user_model()
    users = User.objects.all()
    companies = Organization.objects.all()
    profiles = SellerProfile.objects.all()
    listings = ProductListing.objects.all()
    opportunities = TradeOpportunity.objects.all()
    inquiries = ProductInquiry.objects.all()
    intents = UserIntent.objects.filter(merged_into__isnull=True)

    organization_counts = companies.aggregate(
        verified=Count("pk", filter=Q(verification_status=VerificationStatus.VERIFIED)),
        pending=Count("pk", filter=Q(verification_status=VerificationStatus.PENDING)),
    )
    listing_counts = listings.aggregate(
        total=Count("pk"),
        pending=Count("pk", filter=Q(status=ProductListing.Status.PENDING_REVIEW)),
    )
    opportunity_counts = opportunities.aggregate(
        published=Count("pk", filter=Q(is_published=True, review_status=OpportunityReviewStatus.APPROVED)),
        pending=Count("pk", filter=Q(review_status=OpportunityReviewStatus.PENDING)),
    )
    now = timezone.now()
    open_ticket_count = SupportTicket.objects.exclude(status=TicketStatus.CLOSED).count()
    active_sessions = AdminSession.objects.filter(
        revoked_at__isnull=True, expires_at__gt=now
    ).count()
    failed_logins = AdminAuditEvent.objects.filter(
        action__in=["auth.password", "auth.rate_limited"],
        result="denied",
        created_at__date__range=(start, end),
    ).count()
    metrics = [
        ("total_users", "کل کاربران", users.count()),
        ("active_users", "کاربران فعال", users.filter(is_active=True).count()),
        ("new_registrations", "ثبت‌نام‌های دوره", users.filter(date_joined__date__range=(start, end)).count()),
        ("recent_login_users", "کاربران با ورود در دوره", users.filter(last_login__date__range=(start, end)).count()),
        ("verified_companies", "شرکت‌های تأییدشده", organization_counts["verified"]),
        ("pending_company_verifications", "شرکت‌های در انتظار بررسی", organization_counts["pending"]),
        ("individual_profiles", "پروفایل‌های فردی", profiles.count()),
        ("products_services", "محصولات و خدمات", listing_counts["total"]),
        ("pending_product_approvals", "محصولات در انتظار تأیید", listing_counts["pending"]),
        ("published_opportunities", "فرصت‌های منتشرشده", opportunity_counts["published"]),
        ("pending_trade_opportunities", "فرصت‌های در انتظار بررسی", opportunity_counts["pending"]),
        ("pending_moderation", "صف نظارت", organization_counts["pending"]
         + profiles.filter(verification_status=VerificationStatus.PENDING).count()
         + listing_counts["pending"] + opportunity_counts["pending"]
         + VerificationDocument.objects.filter(review_status="pending").count()),
        ("open_support_tickets", "تیکت‌های باز پشتیبانی", open_ticket_count),
        ("unresolved_inquiries", "استعلام‌های حل‌نشده", inquiries.exclude(status=ProductInquiry.Status.CLOSED).count()),
        ("active_admin_sessions", "نشست‌های فعال مدیران", active_sessions),
        ("failed_admin_logins", "ورودهای ناموفق مدیران", failed_logins),
        ("user_intents", "اهداف ثبت‌شده", intents.count()),
        ("guest_intents", "اهداف مهمانان", intents.filter(user__isnull=True).count()),
    ]

    provincial: dict[str, int] = defaultdict(int)
    for model in (companies, profiles):
        for row in model.filter(province__isnull=False).values("province__name_fa").annotate(count=Count("pk")):
            provincial[row["province__name_fa"]] += row["count"]

    moderation: dict[str, int] = defaultdict(int)
    for queryset, field in (
        (companies, "verification_status"),
        (profiles, "verification_status"),
        (listings, "status"),
        (opportunities, "review_status"),
    ):
        for row in queryset.values(field).annotate(count=Count("pk")):
            moderation[str(row[field] or "unknown")] += row["count"]

    intent_distribution = [
        {"label": str(label), "count": intents.filter(goals__contains=[key]).count()}
        for key, label in IntentGoal.choices
    ]

    return {
        "metrics": [{"key": key, "label": label, "value": value} for key, label, value in metrics],
        "charts": {
            "registration_growth": _daily(users, "date_joined", start, end),
            "company_growth": _daily(companies, "created_at", start, end),
            "opportunity_distribution": _distribution(opportunities, "opportunity_type"),
            "province_activity": [{"label": name, "count": count} for name, count in sorted(provincial.items(), key=lambda item: (-item[1], item[0]))[:12]],
            "category_distribution": _distribution(listings, "category__name"),
            "moderation": [{"label": name, "count": count} for name, count in sorted(moderation.items())],
            "inquiry_trends": _daily(inquiries, "created_at", start, end),
            "intent_distribution": intent_distribution,
        },
    }


@router.get("/")
def dashboard(request: HttpRequest) -> dict[str, Any]:
    actor = require_management(request, "management", "dashboard", "view")
    start, end = _range(request)
    cache_key = f"management:dashboard:v2:{start.isoformat()}:{end.isoformat()}"
    try:
        data = cache.get(cache_key)
    except Exception:
        data = None
    if data is None:
        data = _build(start, end)
        try:
            cache.set(cache_key, data, 60)
        except Exception:
            pass
    activities = []
    if can_manage(actor, "management", "adminauditevent", "view"):
        events = AdminAuditEvent.objects.select_related("actor").only(
            "id", "action", "actor__email", "target_app", "target_model", "target_id", "created_at"
        )[:10]
        activities = [
            {"id": event.pk, "action": event.action,
             "actor": event.actor.email if event.actor else None,
             "target": f"{event.target_app}.{event.target_model}:{event.target_id}",
             "created_at": event.created_at.isoformat()}
            for event in events
        ]
    return {**data, "recent_activities": activities}
