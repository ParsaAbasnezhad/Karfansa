from django.core.exceptions import ValidationError
from django.db import models

from apps.core.uploads import UploadTo
from apps.core.validators import validate_image_extension, validate_image_size


class IndustryCategory(models.TextChoices):
    AGRICULTURE = "agriculture", "کشاورزی"
    FOOD = "food", "صنایع غذایی"
    ENERGY = "energy", "پتروشیمی و انرژی"
    MINING = "mining", "معدن"
    METALS = "metals", "صنایع فلزی"
    TEXTILES = "textiles", "نساجی و پوشاک"
    CHEMICALS = "chemicals", "صنایع شیمیایی"
    CONSTRUCTION = "construction", "ساختمان و مصالح ساختمانی"
    LIVESTOCK_FISHERIES = "livestock-fisheries", "دامپروری و شیلات"
    HANDICRAFTS = "handicrafts", "صنایع دستی"
    TECHNOLOGY = "technology", "فناوری و صنایع دانش‌بنیان"


class Industry(models.Model):
    name_fa = models.CharField(max_length=120, unique=True)
    name_en = models.CharField(max_length=120, blank=True)
    slug = models.SlugField(unique=True)
    description = models.TextField(blank=True, verbose_name="توضیحات")
    category = models.CharField(
        max_length=32,
        choices=IndustryCategory.choices,
        blank=True,
        verbose_name="دسته‌بندی",
    )
    image = models.ImageField(
        upload_to=UploadTo("organizations/industries"),
        blank=True,
        validators=[validate_image_extension, validate_image_size],
        verbose_name="تصویر",
    )
    is_published = models.BooleanField(default=False, verbose_name="منتشر شده")
    products = models.ManyToManyField(
        "organizations.Product",
        blank=True,
        related_name="industries",
        verbose_name="محصولات مرتبط",
    )

    class Meta:
        ordering = ["name_fa"]
        verbose_name = "صنعت"
        verbose_name_plural = "صنایع"
        indexes = [models.Index(fields=["category", "is_published"], name="industry_cat_pub_idx")]

    def __str__(self) -> str:
        return self.name_fa

    def clean(self) -> None:
        if self.is_published and not self.category:
            raise ValidationError({"category": "برای انتشار صنعت، دسته‌بندی را انتخاب کنید."})
