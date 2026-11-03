from typing import Any

from django.db import models

from apps.core.models import UUIDTimeStampedModel
from apps.core.slugs import build_unique_slug
from apps.core.uploads import UploadTo
from apps.core.validators import validate_image_extension, validate_image_size
from apps.organizations.models import Organization


class AdvertisementStatus(models.TextChoices):
    DRAFT = "draft", "پیش‌نویس"
    PENDING = "pending", "در انتظار بررسی"
    PUBLISHED = "published", "منتشرشده"
    REJECTED = "rejected", "ردشده"
    ARCHIVED = "archived", "بایگانی‌شده"


class AdvertisementSource(models.TextChoices):
    COMPANY = "company", "ثبت‌شده توسط شرکت"
    ADMIN = "admin", "ثبت‌شده توسط مدیر سایت"


class Advertisement(UUIDTimeStampedModel):
    """A promotional ad for a company's products or services.

    "Currently showing" is derived, not stored: published AND inside the start/end window.
    The ``created_by`` link to a user is added together with the accounts app.
    """

    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="advertisements"
    )
    title = models.CharField(max_length=150)
    slug = models.SlugField(blank=True)
    description = models.TextField(blank=True)
    image = models.ImageField(
        upload_to=UploadTo("advertising/images"),
        validators=[validate_image_extension, validate_image_size],
    )
    target_url = models.URLField()
    status = models.CharField(
        max_length=10, choices=AdvertisementStatus.choices, default=AdvertisementStatus.DRAFT
    )
    created_via = models.CharField(
        max_length=10, choices=AdvertisementSource.choices, default=AdvertisementSource.COMPANY
    )
    rejection_reason = models.TextField(blank=True)
    start_at = models.DateTimeField(null=True, blank=True)
    end_at = models.DateTimeField(null=True, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "آگهی تبلیغاتی"
        verbose_name_plural = "آگهی‌های تبلیغاتی"
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "slug"], name="advertising_slug_unique"
            ),
            models.CheckConstraint(
                condition=~models.Q(status="published") | models.Q(published_at__isnull=False),
                name="advertising_published_has_date",
            ),
            models.CheckConstraint(
                condition=~models.Q(status="rejected") | ~models.Q(rejection_reason=""),
                name="advertising_rejected_has_reason",
            ),
            models.CheckConstraint(
                condition=models.Q(start_at__isnull=True)
                | models.Q(end_at__isnull=True)
                | models.Q(end_at__gt=models.F("start_at")),
                name="advertising_end_after_start",
            ),
        ]
        indexes = [
            models.Index(fields=["status", "start_at", "end_at"], name="ad_status_window_idx"),
        ]

    def __str__(self) -> str:
        return self.title

    def save(self, *args: Any, **kwargs: Any) -> None:
        if not self.slug:
            self.slug = build_unique_slug(
                Advertisement,
                self.title,
                fallback="ad",
                scope={"organization": self.organization_id},
            )
        super().save(*args, **kwargs)
