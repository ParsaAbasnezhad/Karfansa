from collections import defaultdict
from datetime import date, datetime, time
from typing import Any

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db.models import Count, Model, Q, QuerySet
from django.db.models.functions import TruncMonth
from django.http import HttpRequest
from django.urls import reverse
from django.utils import timezone

from apps.organizations.models import IndustryCategory, Organization
from apps.services.models import ProductInquiry, ProductListing, SellerProfile
from apps.trade.models import OpportunityReviewStatus, TradeOpportunity

_CACHE_KEY = "admin:dashboard:analytics:v1"
_CACHE_TIMEOUT = 300


def _month_range() -> tuple[list[date], datetime]:
    today = timezone.localdate()
    current_month = today.year * 12 + today.month - 1
    start_index = current_month - 11
    start = date(start_index // 12, start_index % 12 + 1, 1)
    months = [
        date((start_index + offset) // 12, (start_index + offset) % 12 + 1, 1)
        for offset in range(12)
    ]
    return months, timezone.make_aware(datetime.combine(start, time.min))


def _monthly_counts(queryset: QuerySet[Model], field: str, start: datetime) -> dict[date, int]:
    rows = (
        queryset.filter(**{f"{field}__gte": start})
        .annotate(month=TruncMonth(field))
        .values("month")
        .annotate(total=Count("pk"))
        .order_by("month")
    )
    return {row["month"].date(): row["total"] for row in rows if row["month"]}


def _build_dashboard() -> dict[str, Any]:
    User = get_user_model()
    months, start = _month_range()
    product_counts = ProductListing.objects.filter(
        listing_kind=ProductListing.Kind.PRODUCT
    ).aggregate(
        total=Count("pk"),
        pending=Count("pk", filter=Q(status=ProductListing.Status.PENDING_REVIEW)),
        approved=Count("pk", filter=Q(status=ProductListing.Status.APPROVED)),
        rejected=Count("pk", filter=Q(status=ProductListing.Status.REJECTED)),
    )
    service_count = ProductListing.objects.filter(listing_kind=ProductListing.Kind.SERVICE).count()
    trade_counts = TradeOpportunity.objects.aggregate(
        total=Count("pk"),
        pending=Count("pk", filter=Q(review_status=OpportunityReviewStatus.PENDING)),
    )

    cards = [
        ("کل کاربران", User.objects.count(), "accounts_user_changelist", ""),
        (
            "شرکت‌های ثبت‌شده",
            Organization.objects.count(),
            "organizations_organization_changelist",
            "",
        ),
        (
            "پروفایل‌های فردی",
            SellerProfile.objects.count(),
            "services_sellerprofile_changelist",
            "",
        ),
        (
            "محصولات",
            product_counts["total"],
            "services_productlisting_changelist",
            "listing_kind__exact=product",
        ),
        (
            "خدمات",
            service_count,
            "services_productlisting_changelist",
            "listing_kind__exact=service",
        ),
        (
            "در انتظار بررسی محصول",
            product_counts["pending"],
            "services_productlisting_changelist",
            "status__exact=pending_review",
        ),
        (
            "محصولات تأییدشده",
            product_counts["approved"],
            "services_productlisting_changelist",
            "status__exact=approved",
        ),
        (
            "محصولات ردشده",
            product_counts["rejected"],
            "services_productlisting_changelist",
            "status__exact=rejected",
        ),
        ("فرصت‌های تجاری", trade_counts["total"], "trade_tradeopportunity_changelist", ""),
        (
            "فرصت‌های در انتظار بررسی",
            trade_counts["pending"],
            "trade_tradeopportunity_changelist",
            "review_status__exact=pending",
        ),
        (
            "درخواست‌های مشتریان",
            ProductInquiry.objects.count(),
            "services_productinquiry_changelist",
            "",
        ),
    ]
    cards_data = []
    for label, value, view_name, query in cards:
        url = reverse(f"admin:{view_name}")
        if query:
            url = f"{url}?{query}"
        cards_data.append({"label": label, "value": value, "url": url})

    labels = [month.strftime("%Y-%m") for month in months]
    users = _monthly_counts(User.objects.all(), "date_joined", start)
    companies = _monthly_counts(Organization.objects.all(), "created_at", start)

    product_status = (
        ProductListing.objects.filter(listing_kind=ProductListing.Kind.PRODUCT)
        .values("status")
        .annotate(total=Count("pk"))
    )
    statuses = {row["status"]: row["total"] for row in product_status}

    opportunities_by_category = TradeOpportunity.objects.values("industry__category").annotate(
        total=Count("pk")
    )
    opportunity_totals = {
        row["industry__category"]: row["total"] for row in opportunities_by_category
    }

    review_totals: dict[tuple[date, str], int] = defaultdict(int)
    product_reviews = (
        ProductListing.objects.filter(
            reviewed_at__gte=start,
            status__in=[ProductListing.Status.APPROVED, ProductListing.Status.REJECTED],
        )
        .annotate(month=TruncMonth("reviewed_at"))
        .values("month", "status")
        .annotate(total=Count("pk"))
    )
    trade_reviews = (
        TradeOpportunity.objects.filter(
            last_reviewed_at__gte=start,
            review_status__in=[
                OpportunityReviewStatus.APPROVED,
                OpportunityReviewStatus.REJECTED,
            ],
        )
        .annotate(month=TruncMonth("last_reviewed_at"))
        .values("month", "review_status")
        .annotate(total=Count("pk"))
    )
    for row in product_reviews:
        if row["month"]:
            review_totals[(row["month"].date(), row["status"])] += row["total"]
    for row in trade_reviews:
        if row["month"]:
            review_totals[(row["month"].date(), row["review_status"])] += row["total"]

    province_totals: dict[str, int] = defaultdict(int)
    organization_provinces = (
        Organization.objects.filter(province__isnull=False)
        .values("province__name_fa")
        .annotate(total=Count("pk"))
    )
    individual_provinces = (
        SellerProfile.objects.filter(province__isnull=False)
        .values("province__name_fa")
        .annotate(total=Count("pk"))
    )
    for row in (*organization_provinces, *individual_provinces):
        province_totals[row["province__name_fa"]] += row["total"]
    top_provinces = sorted(province_totals.items(), key=lambda item: (-item[1], item[0]))[:8]

    return {
        "cards": cards_data,
        "service_count": service_count,
        "charts": {
            "users": {"labels": labels, "values": [users.get(month, 0) for month in months]},
            "companies": {
                "labels": labels,
                "values": [companies.get(month, 0) for month in months],
            },
            "product_status": {
                "labels": [label for value, label in ProductListing.Status.choices],
                "values": [
                    statuses.get(value, 0) for value, _label in ProductListing.Status.choices
                ],
            },
            "opportunity_categories": {
                "labels": [
                    *(label for _value, label in IndustryCategory.choices),
                    "بدون دسته‌بندی",
                ],
                "values": [
                    *(
                        opportunity_totals.get(value, 0)
                        for value, _label in IndustryCategory.choices
                    ),
                    opportunity_totals.get(None, 0),
                ],
            },
            "reviews": {
                "labels": labels,
                "approved": [
                    review_totals[(month, OpportunityReviewStatus.APPROVED)] for month in months
                ],
                "rejected": [
                    review_totals[(month, OpportunityReviewStatus.REJECTED)] for month in months
                ],
            },
            "provinces": {
                "labels": [item[0] for item in top_provinces],
                "values": [item[1] for item in top_provinces],
            },
        },
    }


def dashboard_callback(
    request: HttpRequest,
    context: dict[str, Any],
) -> dict[str, Any]:
    User = get_user_model()
    dashboard_models = (
        User,
        Organization,
        SellerProfile,
        ProductListing,
        TradeOpportunity,
        ProductInquiry,
    )
    if not request.user.is_superuser and not all(
        request.user.has_perm(f"{model._meta.app_label}.view_{model._meta.model_name}")
        for model in dashboard_models
    ):
        context["admin_analytics"] = None
        return context

    context["admin_analytics"] = cache.get_or_set(
        _CACHE_KEY,
        _build_dashboard,
        timeout=_CACHE_TIMEOUT,
    )
    return context
