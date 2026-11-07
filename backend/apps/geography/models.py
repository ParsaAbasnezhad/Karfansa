from django.db import models

from apps.core.uploads import UploadTo
from apps.core.validators import validate_image_extension, validate_image_size


class Country(models.Model):
    name_fa = models.CharField(max_length=100)
    name_en = models.CharField(max_length=100)
    iso2 = models.CharField(max_length=2, unique=True, help_text="ISO 3166-1 alpha-2, e.g. IR")

    class Meta:
        ordering = ["name_fa"]
        verbose_name = "کشور"
        verbose_name_plural = "کشورها"

    def __str__(self) -> str:
        return self.name_fa


class Province(models.Model):
    country = models.ForeignKey(Country, on_delete=models.PROTECT, related_name="provinces")
    name_fa = models.CharField(max_length=100)
    name_en = models.CharField(max_length=100)
    slug = models.SlugField(unique=True)
    capital = models.ForeignKey(
        "City",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="capital_of",
        verbose_name="مرکز استان",
    )
    short_description = models.CharField(max_length=300, blank=True, verbose_name="معرفی کوتاه")
    description = models.TextField(blank=True, verbose_name="معرفی کامل")
    economic_description = models.TextField(blank=True, verbose_name="معرفی اقتصادی")
    area_sq_km = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True, verbose_name="مساحت (کیلومتر مربع)"
    )
    population = models.PositiveBigIntegerField(null=True, blank=True, verbose_name="جمعیت")
    latitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True, verbose_name="عرض جغرافیایی"
    )
    longitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True, verbose_name="طول جغرافیایی"
    )
    featured_image = models.ImageField(
        upload_to=UploadTo("geography/provinces/featured"),
        blank=True,
        validators=[validate_image_extension, validate_image_size],
        verbose_name="تصویر شاخص",
    )
    map_image = models.ImageField(
        upload_to=UploadTo("geography/provinces/maps"),
        blank=True,
        validators=[validate_image_extension, validate_image_size],
        verbose_name="تصویر نقشه",
    )
    is_published = models.BooleanField(default=False, verbose_name="منتشر شده")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاریخ ایجاد")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="تاریخ ویرایش")

    class Meta:
        ordering = ["name_fa"]
        constraints = [
            models.UniqueConstraint(
                fields=["country", "name_fa"], name="geography_province_unique"
            ),
        ]
        verbose_name = "استان"
        verbose_name_plural = "استان‌ها"  # noqa: RUF001

    def __str__(self) -> str:
        return self.name_fa


class City(models.Model):
    province = models.ForeignKey(Province, on_delete=models.PROTECT, related_name="cities")
    name_fa = models.CharField(max_length=100)
    name_en = models.CharField(max_length=100, blank=True)
    slug = models.SlugField(allow_unicode=True, verbose_name="نامک")
    population = models.PositiveBigIntegerField(
        null=True, blank=True, verbose_name="جمعیت"
    )
    description = models.TextField(blank=True, verbose_name="توضیحات")
    is_county_center = models.BooleanField(default=False, verbose_name="مرکز شهرستان")
    latitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True, verbose_name="عرض جغرافیایی"
    )
    longitude = models.DecimalField(
        max_digits=9, decimal_places=6, null=True, blank=True, verbose_name="طول جغرافیایی"
    )

    class Meta:
        ordering = ["name_fa"]
        constraints = [
            models.UniqueConstraint(fields=["province", "name_fa"], name="geography_city_unique"),
            models.UniqueConstraint(fields=["province", "slug"], name="geography_city_slug_unique"),
        ]
        verbose_name = "شهر"
        verbose_name_plural = "شهرها"

    def __str__(self) -> str:
        return self.name_fa


# Keep existing account and company foreign keys on the same city table.
ProvinceCity = City


class ProvinceIndustry(models.Model):
    class ActivityLevel(models.TextChoices):
        LOW = "low", "محدود"
        MEDIUM = "medium", "متوسط"
        HIGH = "high", "بالا"
        STRATEGIC = "strategic", "راهبردی"

    province = models.ForeignKey(
        Province,
        on_delete=models.CASCADE,
        related_name="province_industries",
        verbose_name="استان",
    )
    industry = models.ForeignKey(
        "organizations.Industry",
        on_delete=models.PROTECT,
        related_name="province_industries",
        verbose_name="صنعت",
    )
    description = models.TextField(blank=True, verbose_name="توضیحات در استان")
    activity_level = models.CharField(
        max_length=16,
        choices=ActivityLevel.choices,
        blank=True,
        verbose_name="سطح فعالیت",
    )
    production_capacity = models.DecimalField(
        max_digits=20,
        decimal_places=4,
        null=True,
        blank=True,
        verbose_name="ظرفیت تولید",
    )
    production_capacity_unit = models.CharField(
        max_length=60, blank=True, verbose_name="واحد ظرفیت تولید"
    )
    active_cities = models.ManyToManyField(
        City,
        blank=True,
        related_name="province_industries",
        verbose_name="شهرهای فعال",
    )
    competitive_advantage = models.TextField(blank=True, verbose_name="مزیت رقابتی استان")
    source = models.TextField(blank=True, verbose_name="منبع اطلاعات")
    source_url = models.URLField(blank=True, verbose_name="نشانی منبع")
    updated_year = models.PositiveSmallIntegerField(
        null=True, blank=True, verbose_name="سال آخرین به‌روزرسانی"
    )

    class Meta:
        ordering = ["industry__name_fa"]
        constraints = [
            models.UniqueConstraint(
                fields=["province", "industry"],
                name="geography_province_industry_unique",
            ),
            models.CheckConstraint(
                condition=models.Q(production_capacity__isnull=True)
                | models.Q(production_capacity__gte=0),
                name="province_industry_capacity_nonnegative",
            ),
            models.CheckConstraint(
                condition=models.Q(updated_year__isnull=True) | models.Q(updated_year__gt=0),
                name="province_industry_year_positive",
            ),
            models.CheckConstraint(
                condition=models.Q(production_capacity__isnull=True)
                | (
                    ~models.Q(production_capacity_unit="")
                    & models.Q(updated_year__isnull=False)
                    & (~models.Q(source="") | ~models.Q(source_url=""))
                ),
                name="province_industry_capacity_cited",
            ),
        ]
        indexes = [
            models.Index(fields=["province", "industry"], name="province_industry_idx"),
        ]
        verbose_name = "صنعت در استان"
        verbose_name_plural = "صنایع استان‌ها"  # noqa: RUF001

    def __str__(self) -> str:
        return f"{self.industry} - {self.province}"

    def clean(self) -> None:
        from django.core.exceptions import ValidationError

        if self.production_capacity is not None and (
            not self.production_capacity_unit.strip()
            or (not self.source.strip() and not self.source_url.strip())
            or self.updated_year is None
        ):
            raise ValidationError(
                {
                    "production_capacity": (
                        "برای ثبت ظرفیت تولید، واحد، منبع معتبر و سال به‌روزرسانی الزامی است."
                    )
                }
            )
        if self.pk and self.active_cities.exclude(province_id=self.province_id).exists():
            raise ValidationError(
                {"active_cities": "شهرهای فعال باید متعلق به استان انتخاب‌شده باشند."}
            )
