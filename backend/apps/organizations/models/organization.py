from typing import Any

from django.conf import settings
from django.db import models

from apps.core.models import UUIDTimeStampedModel
from apps.core.slugs import build_unique_slug
from apps.core.uploads import UploadTo
from apps.core.validators import (
    validate_digits,
    validate_image_extension,
    validate_image_size,
    validate_phone,
)
from apps.geography.models import City, Country, Province

from .industry import Industry


class OrganizationType(models.TextChoices):
    MANUFACTURER = "manufacturer", "تولیدی"
    TRADING = "trading", "بازرگانی"
    SUPPLIER = "supplier", "تأمین‌کننده"
    EXPORTER = "exporter", "صادرکننده"
    IMPORTER = "importer", "واردکننده"
    OTHER = "other", "سایر"


class Organization(UUIDTimeStampedModel):
    """A commercial or manufacturing company. Transport companies are a separate app."""

    name = models.CharField(max_length=200)
    english_name = models.CharField(max_length=200, blank=True)
    slug = models.SlugField(unique=True, blank=True)
    logo = models.ImageField(
        upload_to=UploadTo("organizations/logos"),
        blank=True,
        validators=[validate_image_extension, validate_image_size],
    )
    cover_image = models.ImageField(
        upload_to=UploadTo("organizations/covers"),
        blank=True,
        validators=[validate_image_extension, validate_image_size],
    )
    organization_type = models.CharField(
        max_length=20, choices=OrganizationType.choices, default=OrganizationType.OTHER
    )

    # Registry identifiers. Length rules are intentionally loose (digits only) for now.
    national_id = models.CharField(max_length=20, blank=True, validators=[validate_digits])
    registration_number = models.CharField(max_length=30, blank=True)
    economic_code = models.CharField(max_length=20, blank=True, validators=[validate_digits])

    description = models.TextField(blank=True)
    established_at = models.DateField(null=True, blank=True)
    industry = models.ForeignKey(
        Industry, null=True, blank=True, on_delete=models.PROTECT, related_name="organizations"
    )
    members = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        related_name="organizations",
        verbose_name="کاربران مجاز شرکت",
        help_text="کاربرانی که می‌توانند از طرف این شرکت فرصت تجاری ثبت کنند.",
    )

    country = models.ForeignKey(
        Country, null=True, blank=True, on_delete=models.PROTECT, related_name="+"
    )
    province = models.ForeignKey(
        Province, null=True, blank=True, on_delete=models.PROTECT, related_name="+"
    )
    city = models.ForeignKey(
        City, null=True, blank=True, on_delete=models.PROTECT, related_name="+"
    )
    address = models.TextField(blank=True)
    postal_code = models.CharField(max_length=10, blank=True, validators=[validate_digits])

    phone = models.CharField(max_length=20, blank=True, validators=[validate_phone])
    mobile = models.CharField(max_length=20, blank=True, validators=[validate_phone])
    email = models.EmailField(blank=True)
    website = models.URLField(blank=True)
    whatsapp = models.URLField(blank=True)
    telegram = models.URLField(blank=True)
    linkedin = models.URLField(blank=True)
    instagram = models.URLField(blank=True)

    # Set by platform staff only (never by the company itself).
    is_verified = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "شرکت"
        verbose_name_plural = "شرکت‌ها"  # noqa: RUF001
        constraints = [
            models.UniqueConstraint(
                fields=["national_id"],
                condition=~models.Q(national_id=""),
                name="organizations_national_id_unique",
            ),
        ]
        indexes = [
            models.Index(fields=["is_active", "is_verified"], name="org_active_verified_idx"),
            models.Index(fields=["name"], name="org_name_idx"),
        ]

    def __str__(self) -> str:
        return self.name

    def save(self, *args: Any, **kwargs: Any) -> None:
        if not self.slug:
            self.slug = build_unique_slug(
                Organization, self.english_name, self.name, fallback="company"
            )
        super().save(*args, **kwargs)
