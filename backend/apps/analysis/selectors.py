from django.db.models import Count, Prefetch, Q, QuerySet
from django.utils import timezone

from .models import AnalysisAttachment, AnalysisAuthor, AnalysisCategory, AnalysisReport


def public_reports() -> QuerySet[AnalysisReport]:
    now = timezone.now()
    return AnalysisReport.objects.filter(
        Q(status=AnalysisReport.Status.PUBLISHED)
        | Q(status=AnalysisReport.Status.SCHEDULED, published_at__lte=now),
        published_at__lte=now,
    ).select_related("category", "author")


def list_reports(
    *,
    search: str = "",
    category: str = "",
    report_type: str = "",
    ordering: str = "latest",
) -> QuerySet[AnalysisReport]:
    queryset = public_reports()
    if search:
        queryset = queryset.filter(
            Q(title__icontains=search)
            | Q(short_description__icontains=search)
            | Q(author__full_name__icontains=search)
        )
    if category:
        queryset = queryset.filter(category__slug=category)
    if report_type:
        queryset = queryset.filter(report_type=report_type)
    if ordering == "oldest":
        return queryset.order_by("published_at", "title")
    if ordering == "most_viewed":
        return queryset.order_by("-view_count", "-published_at")
    return queryset.order_by("-published_at", "title")


def featured_reports(limit: int = 4) -> QuerySet[AnalysisReport]:
    return public_reports().filter(is_featured=True).order_by("-published_at", "title")[:limit]


def report_detail(slug: str) -> AnalysisReport:
    return (
        public_reports()
        .prefetch_related(
            Prefetch(
                "attachments",
                queryset=AnalysisAttachment.objects.order_by("created_at"),
            )
        )
        .get(slug=slug)
    )


def related_reports(report: AnalysisReport, limit: int = 3) -> QuerySet[AnalysisReport]:
    queryset = public_reports().exclude(pk=report.pk)
    if report.category_id:
        queryset = queryset.filter(category_id=report.category_id)
    return queryset.order_by("-published_at", "title")[:limit]


def report_categories() -> QuerySet[AnalysisCategory]:
    return AnalysisCategory.objects.annotate(
        report_count=Count(
            "reports",
            filter=Q(
                reports__status=AnalysisReport.Status.PUBLISHED,
                reports__published_at__lte=timezone.now(),
            )
            | Q(
                reports__status=AnalysisReport.Status.SCHEDULED,
                reports__published_at__lte=timezone.now(),
            ),
            distinct=True,
        )
    ).order_by("display_order", "name")


def report_authors() -> QuerySet[AnalysisAuthor]:
    return (
        AnalysisAuthor.objects.filter(
            reports__in=public_reports().values("pk"),
        )
        .annotate(report_count=Count("reports", distinct=True))
        .distinct()
        .order_by("full_name")[:12]
    )
