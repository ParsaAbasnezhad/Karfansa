import re
from pathlib import PurePosixPath
from typing import Any
from uuid import uuid4

from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone
from django.utils.html import strip_tags
from django.utils.text import slugify

from apps.core.slugs import build_unique_slug
from apps.core.uploads import UploadTo
from apps.core.validators import validate_image_extension, validate_image_size

from .sanitization import sanitize_html
from .storage import PrivateAnalysisStorage
from .validators import safe_original_filename, validate_analysis_file


class AnalysisCategory(models.Model):
    name = models.CharField(max_length=120, unique=True, verbose_name="نام")
    slug = models.SlugField(max_length=140, unique=True, allow_unicode=True, verbose_name="شناسه")
    description = models.CharField(max_length=300, blank=True, verbose_name="توضیحات")
    display_order = models.PositiveSmallIntegerField(default=0, verbose_name="ترتیب نمایش")

    class Meta:
        ordering = ["display_order", "name"]
        verbose_name = "دسته تحلیل"
        verbose_name_plural = "دسته‌های تحلیل"

    def __str__(self) -> str:
        return self.name

    def save(self, *args: Any, **kwargs: Any) -> None:
        if not self.slug:
            self.slug = slugify(self.name, allow_unicode=True)
        super().save(*args, **kwargs)


class AnalysisAuthor(models.Model):
    full_name = models.CharField(max_length=160, verbose_name="نام و نام خانوادگی")
    position = models.CharField(max_length=180, blank=True, verbose_name="سمت")
    biography = models.TextField(blank=True, verbose_name="زندگی‌نامه")
    profile_image = models.ImageField(
        upload_to=UploadTo("analysis/authors"),
        blank=True,
        validators=[validate_image_extension, validate_image_size],
        verbose_name="تصویر پروفایل",
    )

    class Meta:
        ordering = ["full_name"]
        verbose_name = "تحلیلگر"
        verbose_name_plural = "تحلیلگران"

    def __str__(self) -> str:
        return self.full_name


class AnalysisReport(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "پیش‌نویس"
        SCHEDULED = "scheduled", "زمان‌بندی‌شده"
        PUBLISHED = "published", "منتشرشده"
        ARCHIVED = "archived", "بایگانی‌شده"

    class ReportType(models.TextChoices):
        QUARTERLY = "quarterly_report", "گزارش فصلی"
        ECONOMIC = "economic_analysis", "تحلیل اقتصادی"
        EXPERT_NOTE = "expert_note", "یادداشت تخصصی"
        MARKET = "market_report", "گزارش بازار"
        RESEARCH = "research_report", "گزارش پژوهشی"

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    title = models.CharField(max_length=240, verbose_name="عنوان")
    slug = models.SlugField(max_length=260, unique=True, allow_unicode=True, verbose_name="شناسه")
    short_description = models.CharField(max_length=500, verbose_name="خلاصه")
    content = models.TextField(verbose_name="متن گزارش")
    cover_image = models.ImageField(
        upload_to=UploadTo("analysis/covers"),
        blank=True,
        validators=[validate_image_extension, validate_image_size],
        verbose_name="تصویر اصلی",
    )
    category = models.ForeignKey(
        AnalysisCategory,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="reports",
        verbose_name="دسته‌بندی",
    )
    report_type = models.CharField(
        max_length=32, choices=ReportType.choices, verbose_name="نوع گزارش"
    )
    author = models.ForeignKey(
        AnalysisAuthor,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="reports",
        verbose_name="نویسنده",
    )
    published_at = models.DateTimeField(null=True, blank=True, verbose_name="زمان انتشار")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="زمان ایجاد")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="آخرین ویرایش")
    status = models.CharField(
        max_length=12, choices=Status.choices, default=Status.DRAFT, verbose_name="وضعیت"
    )
    is_featured = models.BooleanField(default=False, verbose_name="گزارش ویژه")
    view_count = models.PositiveBigIntegerField(default=0, editable=False, verbose_name="بازدید")
    download_count = models.PositiveBigIntegerField(
        default=0, editable=False, verbose_name="دریافت فایل"
    )
    seo_title = models.CharField(max_length=240, blank=True, verbose_name="عنوان سئو")
    seo_description = models.CharField(max_length=320, blank=True, verbose_name="توضیحات سئو")

    class Meta:
        ordering = ["-published_at", "title"]
        verbose_name = "تحلیل و گزارش"
        verbose_name_plural = "تحلیل‌ها و گزارش‌ها"
        indexes = [
            models.Index(fields=["status", "published_at"], name="analysis_status_pub_idx"),
            models.Index(
                fields=["category", "status", "published_at"], name="analysis_cat_pub_idx"
            ),
            models.Index(
                fields=["report_type", "status", "published_at"], name="analysis_type_pub_idx"
            ),
            models.Index(
                fields=["is_featured", "status", "published_at"], name="analysis_feat_pub_idx"
            ),
        ]

    def __str__(self) -> str:
        return self.title

    def save(self, *args: Any, **kwargs: Any) -> None:
        if not self.slug:
            self.slug = build_unique_slug(
                AnalysisReport, self.title, fallback=f"analysis-{uuid4().hex[:8]}"
            )
        self.content = sanitize_html(self.content)
        super().save(*args, **kwargs)

    def clean(self) -> None:
        super().clean()
        if self.status in {self.Status.PUBLISHED, self.Status.SCHEDULED} and not self.published_at:
            raise ValidationError(
                {"published_at": "برای انتشار یا زمان‌بندی، زمان انتشار لازم است."}
            )

    @property
    def reading_minutes(self) -> int:
        words = len(re.findall(r"\S+", strip_tags(self.content)))
        return max(1, (words + 219) // 220)

    @property
    def is_public(self) -> bool:
        return self.status in {self.Status.PUBLISHED, self.Status.SCHEDULED} and bool(
            self.published_at and self.published_at <= timezone.now()
        )


class AnalysisAttachment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    report = models.ForeignKey(
        AnalysisReport,
        on_delete=models.CASCADE,
        related_name="attachments",
        verbose_name="گزارش",
    )
    file = models.FileField(
        upload_to=UploadTo("attachments"),
        storage=PrivateAnalysisStorage(),
        validators=[validate_analysis_file],
        verbose_name="فایل",
    )
    original_filename = models.CharField(max_length=255, blank=True, verbose_name="نام فایل")
    file_type = models.CharField(max_length=10, blank=True, editable=False, verbose_name="نوع فایل")
    file_size = models.PositiveBigIntegerField(default=0, editable=False, verbose_name="حجم فایل")
    download_count = models.PositiveBigIntegerField(
        default=0, editable=False, verbose_name="تعداد دریافت"
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="زمان بارگذاری")

    class Meta:
        ordering = ["created_at"]
        verbose_name = "پیوست"
        verbose_name_plural = "پیوست‌ها"

    def __str__(self) -> str:
        return self.original_filename or self.file.name

    def save(self, *args: Any, **kwargs: Any) -> None:
        if self.file:
            self.original_filename = safe_original_filename(
                self.original_filename or self.file.name
            )
            self.file_type = PurePosixPath(self.original_filename).suffix.lstrip(".").upper()
            self.file_size = self.file.size
        super().save(*args, **kwargs)

    def clean(self) -> None:
        super().clean()
        if self.file and self.file.name:
            self.original_filename = safe_original_filename(
                self.original_filename or self.file.name
            )
