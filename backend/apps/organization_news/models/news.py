from typing import Any

from django.db import models

from apps.core.models import UUIDTimeStampedModel
from apps.core.slugs import build_unique_slug
from apps.core.uploads import UploadTo
from apps.core.validators import validate_image_extension, validate_image_size
from apps.organizations.models import Organization


class NewsStatus(models.TextChoices):
    DRAFT = "draft", "پیش‌نویس"
    PENDING = "pending", "در انتظار بررسی"
    PUBLISHED = "published", "منتشرشده"
    REJECTED = "rejected", "ردشده"
    ARCHIVED = "archived", "بایگانی‌شده"


class OrganizationNews(UUIDTimeStampedModel):
    """News, announcements and events published by a company.

    ``content`` is stored as plain text/Markdown and must never be rendered as raw HTML.
    The ``author`` link to a user is added together with the accounts app.
    """

    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="news")
    title = models.CharField(max_length=200)
    slug = models.SlugField(blank=True)
    summary = models.CharField(max_length=300, blank=True)
    content = models.TextField()
    image = models.ImageField(
        upload_to=UploadTo("organization_news/images"),
        blank=True,
        validators=[validate_image_extension, validate_image_size],
    )
    source_url = models.URLField(blank=True)
    status = models.CharField(max_length=10, choices=NewsStatus.choices, default=NewsStatus.DRAFT)
    published_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-published_at", "-created_at"]
        verbose_name = "خبر شرکت"
        verbose_name_plural = "اخبار شرکت‌ها"
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "slug"], name="organization_news_slug_unique"
            ),
            models.CheckConstraint(
                condition=~models.Q(status="published") | models.Q(published_at__isnull=False),
                name="organization_news_published_has_date",
            ),
        ]
        indexes = [
            models.Index(fields=["status", "-published_at"], name="news_status_published_idx"),
            models.Index(fields=["organization", "status"], name="news_org_status_idx"),
        ]

    def __str__(self) -> str:
        return self.title

    def save(self, *args: Any, **kwargs: Any) -> None:
        if not self.slug:
            self.slug = build_unique_slug(
                OrganizationNews,
                self.title,
                fallback="news",
                scope={"organization": self.organization_id},
                max_length=50,
            )
        super().save(*args, **kwargs)
