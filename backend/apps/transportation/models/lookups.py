from django.db import models


class TransportMode(models.Model):
    """Road, rail, sea, air or multimodal. Rows are seeded by migration 0002."""

    code = models.SlugField(unique=True)
    name_fa = models.CharField(max_length=60)
    name_en = models.CharField(max_length=60)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "name_fa"]
        verbose_name = "نوع حمل‌ونقل"
        verbose_name_plural = "انواع حمل‌ونقل"

    def __str__(self) -> str:
        return self.name_fa


class VehicleType(models.Model):
    """Truck, container ship, freight wagon and so on. Managed by staff."""

    slug = models.SlugField(unique=True)
    name_fa = models.CharField(max_length=100, unique=True)
    name_en = models.CharField(max_length=100, blank=True)
    mode = models.ForeignKey(
        TransportMode,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="vehicle_types",
    )

    class Meta:
        ordering = ["name_fa"]
        verbose_name = "نوع وسیله نقلیه"
        verbose_name_plural = "انواع وسیله نقلیه"

    def __str__(self) -> str:
        return self.name_fa
