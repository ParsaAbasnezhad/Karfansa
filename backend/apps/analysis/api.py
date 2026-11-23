import hashlib
import mimetypes
from typing import Literal
from uuid import UUID

from django.core.cache import cache
from django.db.models import F, QuerySet
from django.http import FileResponse, HttpRequest, HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.cache import cache_page
from ninja import Query, Router
from ninja.decorators import decorate_view

from . import selectors
from .models import AnalysisAttachment, AnalysisAuthor, AnalysisCategory, AnalysisReport
from .schemas import (
    AnalysisAuthorOut,
    AnalysisCategoryOut,
    AnalysisDetailPageOut,
    AnalysisPageOut,
    AnalysisReportOut,
)

router = Router()
DOWNLOAD_LIMIT_PER_MINUTE = 20
COUNTER_FLUSH_EVERY = 20
COUNTER_TTL_SECONDS = 60 * 60 * 24 * 30


def _bump_metric(key: str, queryset: QuerySet, field: str) -> None:
    cache.add(key, 0, timeout=COUNTER_TTL_SECONDS)
    count = cache.incr(key)
    if count % COUNTER_FLUSH_EVERY == 0:
        queryset.update(**{field: F(field) + COUNTER_FLUSH_EVERY})


def _within_download_limit(request: HttpRequest) -> bool:
    address = request.META.get("REMOTE_ADDR", "unknown")
    ip_hash = hashlib.sha256(address.encode()).hexdigest()[:24]
    key = f"analysis:download-rate:{ip_hash}:{timezone.now():%Y%m%d%H%M}"
    cache.add(key, 0, timeout=120)
    return cache.incr(key) <= DOWNLOAD_LIMIT_PER_MINUTE


@router.get("/", response=AnalysisPageOut, operation_id="analysis_reports_list")
@decorate_view(cache_page(60))
def list_analysis_reports(
    request: HttpRequest,
    search: str = "",
    category: str = "",
    report_type: Literal[
        "quarterly_report",
        "economic_analysis",
        "expert_note",
        "market_report",
        "research_report",
        "",
    ] = "",
    ordering: Literal["latest", "oldest", "most_viewed"] = "latest",
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=50),
) -> dict[str, object]:
    queryset = selectors.list_reports(
        search=search[:160],
        category=category[:140],
        report_type=report_type,
        ordering=ordering,
    )
    count = queryset.count()
    start = (page - 1) * page_size
    items = queryset[start : start + page_size]
    return {
        "items": items,
        "count": count,
        "page": page,
        "page_size": page_size,
        "total_pages": (count + page_size - 1) // page_size,
    }


@router.get(
    "/featured/",
    response=list[AnalysisReportOut],
    operation_id="analysis_reports_featured",
)
@decorate_view(cache_page(60))
def featured_analysis_reports(request: HttpRequest) -> QuerySet[AnalysisReport]:
    return selectors.featured_reports()


@router.get(
    "/categories/", response=list[AnalysisCategoryOut], operation_id="analysis_categories_list"
)
@decorate_view(cache_page(300))
def list_analysis_categories(request: HttpRequest) -> QuerySet[AnalysisCategory]:
    return selectors.report_categories()


@router.get("/authors/", response=list[AnalysisAuthorOut], operation_id="analysis_authors_list")
@decorate_view(cache_page(300))
def list_analysis_authors(request: HttpRequest) -> QuerySet[AnalysisAuthor]:
    return selectors.report_authors()


@router.get(
    "/{slug}/attachments/{attachment_id}/download/",
    response=None,
    operation_id="analysis_attachment_download",
)
def download_analysis_attachment(
    request: HttpRequest, slug: str, attachment_id: UUID
) -> HttpResponse:
    if not _within_download_limit(request):
        return HttpResponse("تعداد درخواست دریافت فایل بیش از حد مجاز است.", status=429)

    report = get_object_or_404(selectors.public_reports(), slug=slug)
    attachment = get_object_or_404(
        AnalysisAttachment.objects.filter(report=report), pk=attachment_id
    )
    try:
        stream = attachment.file.open("rb")
    except (FileNotFoundError, OSError):
        return HttpResponse("فایل در دسترس نیست.", status=404)

    _bump_metric(
        f"analysis:attachment-download:{attachment.pk}",
        AnalysisAttachment.objects.filter(pk=attachment.pk),
        "download_count",
    )
    _bump_metric(
        f"analysis:report-download:{report.pk}",
        AnalysisReport.objects.filter(pk=report.pk),
        "download_count",
    )
    content_type = (
        mimetypes.guess_type(attachment.original_filename)[0] or "application/octet-stream"
    )
    response = FileResponse(
        stream,
        as_attachment=True,
        filename=attachment.original_filename,
        content_type=content_type,
    )
    response["X-Content-Type-Options"] = "nosniff"
    response["Cache-Control"] = "private, no-store"
    return response


@router.get("/{slug}/", response=AnalysisDetailPageOut, operation_id="analysis_report_detail")
@decorate_view(cache_page(60))
def get_analysis_report(request: HttpRequest, slug: str) -> dict[str, object]:
    report = get_object_or_404(selectors.public_reports(), slug=slug)
    report = selectors.report_detail(report.slug)
    _bump_metric(
        f"analysis:report-view:{report.pk}",
        AnalysisReport.objects.filter(pk=report.pk),
        "view_count",
    )
    return {"report": report, "related": selectors.related_reports(report)}
