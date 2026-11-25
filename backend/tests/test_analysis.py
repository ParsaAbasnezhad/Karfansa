from datetime import timedelta
from pathlib import Path
from tempfile import TemporaryDirectory

import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from django.core.files.storage import FileSystemStorage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client
from django.utils import timezone

from apps.analysis.models import AnalysisAttachment, AnalysisCategory, AnalysisReport
from apps.analysis.validators import validate_analysis_file

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def clear_analysis_cache():
    from django.core.cache import cache

    cache.clear()


@pytest.fixture
def category():
    return AnalysisCategory.objects.create(name="اقتصاد", slug="economy")


def create_report(*, title="تحلیل بازار", category=None, status=None, published_at=None, **kwargs):
    status = status or AnalysisReport.Status.PUBLISHED
    content = kwargs.pop("content", "<p>محتوای کامل گزارش</p>")
    if published_at is None and status in {
        AnalysisReport.Status.PUBLISHED,
        AnalysisReport.Status.SCHEDULED,
    }:
        published_at = timezone.now() - timedelta(hours=1)
    return AnalysisReport.objects.create(
        title=title,
        slug=kwargs.pop("slug", title.replace(" ", "-")),
        short_description="خلاصه گزارش",
        content=content,
        report_type=AnalysisReport.ReportType.ECONOMIC,
        category=category,
        status=status,
        published_at=published_at,
        **kwargs,
    )


def test_public_listing_filters_and_paginates_reports(category):
    create_report(title="گزارش اقتصاد اول", category=category)
    create_report(title="گزارش اقتصاد دوم", category=category)
    create_report(title="گزارش بایگانی", category=category, status=AnalysisReport.Status.ARCHIVED)
    client = Client()

    response = client.get(
        "/api/v1/analysis/",
        {"category": category.slug, "search": "اقتصاد", "page_size": 1},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["count"] == 2
    assert data["total_pages"] == 2
    assert len(data["items"]) == 1


def test_draft_archived_and_future_scheduled_reports_are_not_public():
    create_report(title="پیش‌نویس", status=AnalysisReport.Status.DRAFT)
    create_report(title="بایگانی", status=AnalysisReport.Status.ARCHIVED)
    create_report(
        title="انتشار آینده",
        status=AnalysisReport.Status.SCHEDULED,
        published_at=timezone.now() + timedelta(days=1),
    )
    scheduled = create_report(
        title="انتشار انجام‌شده",
        slug="scheduled-public",
        status=AnalysisReport.Status.SCHEDULED,
        published_at=timezone.now() - timedelta(hours=1),
    )

    response = Client().get("/api/v1/analysis/")

    assert response.status_code == 200
    assert response.json()["count"] == 1
    assert response.json()["items"][0]["slug"] == scheduled.slug


def test_published_detail_includes_content_and_related_reports(category):
    report = create_report(title="گزارش اصلی", slug="main", category=category)
    create_report(title="گزارش مرتبط", slug="related", category=category)
    client = Client()

    response = client.get(f"/api/v1/analysis/{report.slug}/")

    assert response.status_code == 200
    assert response.json()["report"]["content"] == "<p>محتوای کامل گزارش</p>"
    assert [item["slug"] for item in response.json()["related"]] == ["related"]
    assert response.json()["report"]["published_at"]


def test_report_save_sanitizes_unsafe_rich_content():
    report = create_report(
        title="گزارش امن",
        slug="safe-content",
        content='<p onclick="alert(1)">متن</p><script>alert(1)</script>'
        '<a href="javascript:alert(1)">پیوند</a>',
    )

    assert "onclick" not in report.content
    assert "<script" not in report.content
    assert "javascript:" not in report.content
    assert "متن" in report.content


def test_file_validator_rejects_unsupported_and_invalid_files():
    with pytest.raises(ValidationError):
        validate_analysis_file(SimpleUploadedFile("payload.exe", b"no"))
    with pytest.raises(ValidationError):
        validate_analysis_file(SimpleUploadedFile("report.pdf", b"not a PDF"))

    valid_pdf = SimpleUploadedFile("report.pdf", b"%PDF-1.7\ncontent")
    validate_analysis_file(valid_pdf)


def test_download_requires_a_public_report_and_streams_private_attachment(monkeypatch):
    report = create_report(title="فایل‌دار", slug="file-report")
    attachment = AnalysisAttachment(report=report)
    field = AnalysisAttachment._meta.get_field("file")
    with TemporaryDirectory(prefix="analysis-test-", dir=Path(__file__).parent) as storage_path:
        monkeypatch.setattr(field, "storage", FileSystemStorage(location=storage_path))
        attachment.file.save("report.pdf", ContentFile(b"%PDF-1.7\ncontent"), save=False)
        attachment.save()
        client = Client()

        response = client.get(
            f"/api/v1/analysis/{report.slug}/attachments/{attachment.pk}/download/"
        )

        assert response.status_code == 200
        assert response["Content-Disposition"].startswith("attachment;")
        assert response["X-Content-Type-Options"] == "nosniff"
        assert b"".join(response.streaming_content) == b"%PDF-1.7\ncontent"

        report.status = AnalysisReport.Status.DRAFT
        report.save(update_fields=["status"])
        hidden_response = client.get(
            f"/api/v1/analysis/{report.slug}/attachments/{attachment.pk}/download/"
        )
        assert hidden_response.status_code == 404


def test_regular_user_cannot_access_report_admin():
    user = get_user_model().objects.create_user(
        email="reader@example.test",
        password="password",
        phone="09120000000",
    )
    client = Client()
    client.force_login(user)

    response = client.get("/admin/analysis/analysisreport/")

    assert response.status_code == 302
