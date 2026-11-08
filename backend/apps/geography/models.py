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


class ProvinceStatistics(models.Model):
    class Category(models.TextChoices):
        FOREIGN_TRADE = "foreign_trade", "تجارت خارجی"
        PRODUCTION = "production", "تولید"
        INDUSTRY = "industry", "صنعت"
        EMPLOYMENT = "employment", "اشتغال"
        AGRICULTURE = "agriculture", "کشاورزی"

    class Indicator(models.TextChoices):
        EXPORT_VALUE = "export_value", "ارزش صادرات استان"
        IMPORT_VALUE = "import_value", "ارزش واردات استان"
        FOREIGN_TRADE_VALUE = "foreign_trade_value", "حجم تجارت خارجی"
        TOP_EXPORT_PRODUCTS = "top_export_products", "مهم‌ترین کالاهای صادراتی"
        TOP_IMPORT_PRODUCTS = "top_import_products", "مهم‌ترین کالاهای وارداتی"
        EXPORT_DESTINATIONS = "export_destinations", "کشورهای مقصد صادرات"
        IMPORT_ORIGINS = "import_origins", "کشورهای مبدأ واردات"
        SECTOR_PRODUCTION_VALUE = "sector_production_value", "ارزش تولید بخش‌های اقتصادی"
        INDUSTRIAL_PRODUCTION_GROWTH = "industrial_production_growth", "نرخ رشد تولید صنعتی"
        INDUSTRIAL_EMPLOYMENT = "industrial_employment", "میزان اشتغال صنعتی"
        AGRICULTURAL_PRODUCTION = "agricultural_production", "میزان تولید محصولات کشاورزی"
        ACTIVE_INDUSTRIAL_UNITS = "active_industrial_units", "تعداد واحدهای صنعتی فعال"

    class Period(models.TextChoices):
        ANNUAL = "annual", "سالانه"
        QUARTERLY = "quarterly", "فصلی"
        MONTHLY = "monthly", "ماهانه"

    class ValidationStatus(models.TextChoices):
        PENDING = "pending", "در انتظار بررسی"
        VALIDATED = "validated", "تأییدشده"
        REJECTED = "rejected", "ردشده"

    INDICATOR_CATEGORIES: dict[str, Category] = {
        Indicator.EXPORT_VALUE: Category.FOREIGN_TRADE,
        Indicator.IMPORT_VALUE: Category.FOREIGN_TRADE,
        Indicator.FOREIGN_TRADE_VALUE: Category.FOREIGN_TRADE,
        Indicator.TOP_EXPORT_PRODUCTS: Category.FOREIGN_TRADE,
        Indicator.TOP_IMPORT_PRODUCTS: Category.FOREIGN_TRADE,
        Indicator.EXPORT_DESTINATIONS: Category.FOREIGN_TRADE,
        Indicator.IMPORT_ORIGINS: Category.FOREIGN_TRADE,
        Indicator.SECTOR_PRODUCTION_VALUE: Category.PRODUCTION,
        Indicator.INDUSTRIAL_PRODUCTION_GROWTH: Category.INDUSTRY,
        Indicator.INDUSTRIAL_EMPLOYMENT: Category.EMPLOYMENT,
        Indicator.AGRICULTURAL_PRODUCTION: Category.AGRICULTURE,
        Indicator.ACTIVE_INDUSTRIAL_UNITS: Category.INDUSTRY,
    }

    province = models.ForeignKey(
        Province,
        on_delete=models.CASCADE,
        related_name="statistics",
        verbose_name="استان",
    )
    indicator = models.CharField(
        max_length=40, choices=Indicator.choices, verbose_name="شاخص آماری"
    )
    category = models.CharField(
        max_length=20, choices=Category.choices, verbose_name="دسته‌بندی شاخص"
    )
    value = models.DecimalField(
        max_digits=24, decimal_places=6, null=True, blank=True, verbose_name="مقدار عددی"
    )
    value_text = models.CharField(
        max_length=500, blank=True, verbose_name="مقدار متنی"
    )
    item_label = models.CharField(
        max_length=200, blank=True, verbose_name="عنوان کالا، کشور یا بخش"
    )
    unit = models.CharField(max_length=80, verbose_name="واحد اندازه‌گیری")
    statistical_year = models.PositiveSmallIntegerField(verbose_name="سال آماری")
    period = models.CharField(
        max_length=10, choices=Period.choices, verbose_name="دوره آماری"
    )
    period_number = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        verbose_name="شماره ماه یا فصل",
        help_text="برای دوره فصلی ۱ تا ۴ و برای دوره ماهانه ۱ تا ۱۲؛ برای آمار سالانه خالی بماند.",  # noqa: RUF001
    )
    source = models.CharField(max_length=200, blank=True, verbose_name="منبع اطلاعات")
    source_url = models.URLField(blank=True, verbose_name="نشانی منبع")
    source_published_at = models.DateField(
        null=True, blank=True, verbose_name="تاریخ انتشار منبع"
    )
    collected_at = models.DateField(
        null=True, blank=True, verbose_name="تاریخ دریافت اطلاعات"
    )
    notes = models.TextField(blank=True, verbose_name="توضیحات")
    validation_status = models.CharField(
        max_length=10,
        choices=ValidationStatus.choices,
        default=ValidationStatus.PENDING,
        verbose_name="وضعیت اعتبارسنجی",
    )

    class Meta:
        ordering = ["-statistical_year", "indicator", "period_number", "item_label"]
        constraints = [
            models.UniqueConstraint(
                fields=[
                    "province",
                    "indicator",
                    "statistical_year",
                    "period",
                    "period_number",
                    "item_label",
                ],
                condition=models.Q(period_number__isnull=False),
                name="province_statistic_period_item_unique",
            ),
            models.UniqueConstraint(
                fields=["province", "indicator", "statistical_year", "period", "item_label"],
                condition=models.Q(period_number__isnull=True),
                name="province_statistic_annual_item_unique",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(period="annual", period_number__isnull=True)
                    | models.Q(period="quarterly", period_number__gte=1, period_number__lte=4)
                    | models.Q(period="monthly", period_number__gte=1, period_number__lte=12)
                ),
                name="province_statistic_period_number_valid",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(value__isnull=False)
                    | ~models.Q(value_text="")
                    | ~models.Q(item_label="")
                ),
                name="province_statistic_has_value",
            ),
            models.CheckConstraint(
                condition=(
                    ~models.Q(validation_status="validated")
                    | (
                        ~models.Q(source="")
                        & ~models.Q(unit="")
                        & (
                            models.Q(value__isnull=False)
                            | ~models.Q(value_text="")
                            | ~models.Q(item_label="")
                        )
                    )
                ),
                name="province_statistic_validated_cited",
            ),
        ]
        indexes = [
            models.Index(
                fields=["province", "indicator", "statistical_year"],
                name="province_statistic_lookup_idx",
            ),
            models.Index(
                fields=["indicator", "statistical_year", "period"],
                name="statistic_compare_lookup_idx",
            ),
        ]
        verbose_name = "آمار اقتصادی استان"
        verbose_name_plural = "آمار اقتصادی استان‌ها"  # noqa: RUF001

    def __str__(self) -> str:
        return f"{self.get_indicator_display()} - {self.province} - {self.statistical_year}"

    def clean(self) -> None:
        from django.core.exceptions import ValidationError

        errors: dict[str, str] = {}
        expected_category = self.INDICATOR_CATEGORIES.get(self.indicator)
        if expected_category and self.category != expected_category:
            errors["category"] = "دسته‌بندی باید با شاخص آماری انتخاب‌شده مطابقت داشته باشد."
        if self.validation_status == self.ValidationStatus.VALIDATED and not (
            self.source.strip() and self.unit.strip()
        ):
            errors["validation_status"] = (
                "برای تأیید آمار، درج منبع و واحد اندازه‌گیری الزامی است."
            )
        if self.period == self.Period.ANNUAL and self.period_number is not None:
            errors["period_number"] = "برای آمار سالانه شماره دوره وارد نکنید."
        elif self.period == self.Period.QUARTERLY and self.period_number not in range(1, 5):
            errors["period_number"] = "شماره فصل باید بین ۱ تا ۴ باشد."  # noqa: RUF001
        elif self.period == self.Period.MONTHLY and self.period_number not in range(1, 13):
            errors["period_number"] = "شماره ماه باید بین ۱ تا ۱۲ باشد."  # noqa: RUF001
        if errors:
            raise ValidationError(errors)
