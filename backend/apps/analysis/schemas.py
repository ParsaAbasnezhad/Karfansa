from datetime import datetime
from uuid import UUID

from ninja import Schema

from .models import AnalysisAttachment, AnalysisAuthor, AnalysisReport


class AnalysisCategoryOut(Schema):
    slug: str
    name: str
    description: str
    report_count: int = 0


class AnalysisAuthorOut(Schema):
    full_name: str
    position: str
    biography: str = ""
    profile_image: str | None
    report_count: int = 0

    @staticmethod
    def resolve_profile_image(obj: AnalysisAuthor) -> str | None:
        return obj.profile_image.url if obj.profile_image else None


class AnalysisAttachmentOut(Schema):
    id: UUID
    original_filename: str
    file_type: str
    file_size: int
    download_url: str

    @staticmethod
    def resolve_download_url(obj: AnalysisAttachment) -> str:
        return f"/api/v1/analysis/{obj.report.slug}/attachments/{obj.pk}/download/"


class AnalysisReportOut(Schema):
    id: UUID
    slug: str
    title: str
    short_description: str
    cover_image: str | None
    category: AnalysisCategoryOut | None
    report_type: str
    author: AnalysisAuthorOut | None
    published_at: datetime
    is_featured: bool
    view_count: int
    download_count: int
    reading_minutes: int

    @staticmethod
    def resolve_cover_image(obj: AnalysisReport) -> str | None:
        return obj.cover_image.url if obj.cover_image else None


class AnalysisReportDetailOut(AnalysisReportOut):
    content: str
    seo_title: str
    seo_description: str
    attachments: list[AnalysisAttachmentOut]


class AnalysisPageOut(Schema):
    items: list[AnalysisReportOut]
    count: int
    page: int
    page_size: int
    total_pages: int


class AnalysisDetailPageOut(Schema):
    report: AnalysisReportDetailOut
    related: list[AnalysisReportOut]
