from typing import Any

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

from ..validators import validate_instagram_contact, validate_telegram_contact
from .lookups import TransportMode, VehicleType


class TransportCompany(UUIDTimeStampedModel):
    """A land, sea, air or rail transport company.

    Deliberately independent of ``organizations``: transport companies are their own category.
    Types, vehicles and coverage use real tables (not JSON) so they can be filtered precisely.
    """

    name = models.CharField(max_length=200)
    english_name = models.CharField(max_length=200, blank=True)
    slug = models.SlugField(unique=True, blank=True)
    logo = models.ImageField(
        upload_to=UploadTo("transportation/logos"),
        blank=True,
        validators=[validate_image_extension, validate_image_size],
    )
    cover_image = models.ImageField(
        upload_to=UploadTo("transportation/covers"),
        blank=True,
        validators=[validate_image_extension, validate_image_size],
    )
    national_id = models.CharField(max_length=20, blank=True, validators=[validate_digits])
    registration_number = models.CharField(max_length=30, blank=True)
    description = models.TextField(blank=True)

    transport_types = models.ManyToManyField(TransportMode, blank=True, related_name="companies")
    vehicle_types = models.ManyToManyField(VehicleType, blank=True, related_name="companies")
    service_provinces = models.ManyToManyField(
        Province, blank=True, related_name="transport_companies"
    )
    origin_countries = models.ManyToManyField(
        Country, blank=True, related_name="transport_origin_companies"
    )
    destination_countries = models.ManyToManyField(
        Country, blank=True, related_name="transport_destination_companies"
    )
    fleet_capacity = models.CharField(max_length=100, blank=True)
    tracking_available = models.BooleanField(default=False)
    insurance_available = models.BooleanField(default=False)
    customs_services = models.BooleanField(default=False)

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

    phone = models.CharField(max_length=20, blank=True, validators=[validate_phone])
    mobile = models.CharField(max_length=20, blank=True, validators=[validate_phone])
    email = models.EmailField(blank=True)
    website = models.URLField(blank=True)
    whatsapp = models.URLField(blank=True)
    telegram = models.CharField(max_length=255, blank=True, validators=[validate_telegram_contact])
    instagram = models.CharField(
        max_length=255, blank=True, validators=[validate_instagram_contact]
    )

    # Set by platform staff only (never by the company itself).
    is_verified = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "شرکت حمل‌ونقل"
        verbose_name_plural = "شرکت‌های حمل‌ونقل"
        constraints = [
            models.UniqueConstraint(
                fields=["national_id"],
                condition=~models.Q(national_id=""),
                name="transportation_national_id_unique",
            ),
        ]
        indexes = [
            models.Index(fields=["is_active", "is_verified"], name="tc_active_verified_idx"),
            models.Index(fields=["name"], name="tc_name_idx"),
        ]

    def __str__(self) -> str:
        return self.name

    def save(self, *args: Any, **kwargs: Any) -> None:
        if not self.slug:
            self.slug = build_unique_slug(
                TransportCompany, self.english_name, self.name, fallback="transport"
            )
        super().save(*args, **kwargs)
