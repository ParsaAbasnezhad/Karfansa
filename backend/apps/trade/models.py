from typing import Any

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from apps.core.slugs import build_unique_slug
from apps.geography.models import City, Province
from apps.organizations.models import Industry, Organization, Product


class OpportunityType(models.TextChoices):
    EXPORT = "export", "صادرات"
    IMPORT = "import", "واردات"
    RAW_MATERIALS = "raw-materials", "تأمین مواد اولیه"
    BULK_BUY = "bulk-buy", "خرید عمده"
    BULK_SELL = "bulk-sell", "فروش عمده"
    PARTNERSHIP = "partnership", "همکاری تجاری"
    INVESTMENT = "investment", "سرمایه‌گذاری"


class OpportunityReviewStatus(models.TextChoices):
    PENDING = "pending", "در انتظار بررسی"
    APPROVED = "approved", "تأییدشده"
    REJECTED = "rejected", "ردشده"


class OpportunityLevel(models.TextChoices):
    NORMAL = "normal", "فرصت عادی"
    IMPORTANT = "important", "فرصت مهم"
    HIGH_PROFIT = "high-profit", "سودآوری بالا"
    SPECIAL = "special", "فرصت ویژه"
    STRATEGIC = "strategic", "فرصت استراتژیک"

class TradeOpportunity(models.Model):
    title = models.CharField(max_length=250, verbose_name="عنوان فرصت")
    slug = models.SlugField(max_length=120, unique=True, blank=True, verbose_name="نامک")
    province = models.ForeignKey(
        Province,
        on_delete=models.PROTECT,
        related_name="trade_opportunities",
        verbose_name="استان",
    )
    city = models.ForeignKey(
        City,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="trade_opportunities",
        verbose_name="شهر",
    )
    product = models.ForeignKey(
        Product,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="trade_opportunities",
        verbose_name="محصول مرتبط",
    )
    service_listing = models.OneToOneField(
        "services.ProductListing",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="trade_opportunity",
        verbose_name="محصول بازار خدمات",
    )
    industry = models.ForeignKey(
        Industry,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="trade_opportunities",
        verbose_name="صنعت مرتبط",
    )
    opportunity_level = models.CharField(
        max_length=20,
        choices=OpportunityLevel.choices,
        default=OpportunityLevel.NORMAL,
        db_index=True,
        verbose_name="سطح اهمیت فرصت",
    )
    opportunity_type = models.CharField(
        max_length=20,
        choices=OpportunityType.choices,
        verbose_name="نوع فرصت",
    )
    description = models.TextField(verbose_name="توضیحات کامل")
    target_market = models.CharField(
        max_length=300,
        blank=True,
        verbose_name="کشور یا بازار هدف",
        help_text="برای چند بازار، نام کشورها را با ویرگول جدا کنید.",
    )
    required_volume = models.DecimalField(
        max_digits=20,
        decimal_places=4,
        null=True,
        blank=True,
        verbose_name="حجم یا ظرفیت موردنیاز",
    )
    volume_unit = models.CharField(max_length=60, blank=True, verbose_name="واحد اندازه‌گیری")
    min_value = models.DecimalField(
        max_digits=20,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="حداقل ارزش مالی",
    )
    max_value = models.DecimalField(
        max_digits=20,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="حداکثر ارزش مالی",
    )
    currency = models.CharField(
        max_length=3,
        blank=True,
        verbose_name="واحد پول",
        help_text="کد ISO 4217 مانند IRR، USD یا EUR.",
    )
    company = models.ForeignKey(
        Organization,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="trade_opportunities",
        verbose_name="شرکت مرتبط",
    )
    source = models.CharField(
        max_length=300,
        blank=True,
        verbose_name="منبع کشف یا ثبت فرصت",
        help_text="منبع باید هنگام بررسی مدیر ارزیابی شود؛ فرصت‌های ارسالی تا آن زمان عمومی نیستند.",
    )

    source_url = models.URLField(blank=True, verbose_name="نشانی منبع")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="submitted_trade_opportunities",
        verbose_name="ثبت‌کننده",
    )
    published_at = models.DateTimeField(
        null=True,
        blank=True,
        editable=False,
        verbose_name="تاریخ انتشار",
    )
    valid_until = models.DateField(
        null=True,
        blank=True,
        verbose_name="تاریخ اعتبار",
    )
    review_status = models.CharField(
        max_length=12,
        choices=OpportunityReviewStatus.choices,
        default=OpportunityReviewStatus.PENDING,
        verbose_name="وضعیت بررسی",
    )
    is_published = models.BooleanField(default=False, verbose_name="منتشر شده")
    relevance_score = models.PositiveSmallIntegerField(
        default=0,
        verbose_name="امتیاز ارتباط",
        help_text="امتیاز 0 تا 100 را مدیر بر اساس کیفیت و ارتباط فرصت تعیین می‌کند.",
    )
    last_reviewed_at = models.DateTimeField(
        null=True,
        blank=True,
        editable=False,
        verbose_name="آخرین بررسی",
    )
    last_reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="reviewed_trade_opportunities",
        editable=False,
        verbose_name="آخرین بررسی‌کننده",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="تاریخ ثبت")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="تاریخ ویرایش")

    class Meta:
        ordering = ["-published_at", "title"]
        verbose_name = "فرصت تجاری"
        verbose_name_plural = "فرصت‌های تجاری"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(required_volume__isnull=True)
                | models.Q(required_volume__gte=0),
                name="trade_volume_nonnegative",
            ),
            models.CheckConstraint(
                condition=models.Q(min_value__isnull=True) | models.Q(min_value__gte=0),
                name="trade_min_value_nonnegative",
            ),
            models.CheckConstraint(
                condition=models.Q(max_value__isnull=True) | models.Q(max_value__gte=0),
                name="trade_max_value_nonnegative",
            ),
            models.CheckConstraint(
                condition=models.Q(min_value__isnull=True, max_value__isnull=True, currency="")
                | (
                    models.Q(min_value__isnull=False)
                    & models.Q(max_value__isnull=False)
                    & ~models.Q(currency="")
                ),
                name="trade_value_range_complete",
            ),
            models.CheckConstraint(
                condition=models.Q(min_value__isnull=True)
                | models.Q(max_value__gte=models.F("min_value")),
                name="trade_value_range_ordered",
            ),
            models.CheckConstraint(
                condition=models.Q(is_published=False)
                | models.Q(review_status=OpportunityReviewStatus.APPROVED),
                name="trade_public_opportunity_approved",
            ),
            models.CheckConstraint(
                condition=models.Q(relevance_score__lte=100),
                name="trade_relevance_score_max",
            ),
        ]
        indexes = [
            models.Index(
                fields=["review_status", "is_published", "-published_at"],
                name="trade_public_date_idx",
            ),
            models.Index(fields=["province", "opportunity_type"], name="trade_prov_type_idx"),
            models.Index(fields=["required_volume"], name="trade_volume_idx"),
        ]

    def __str__(self) -> str:
        return self.title

    def save(self, *args: Any, **kwargs: Any) -> None:
        if not self.slug:
            self.slug = build_unique_slug(
                TradeOpportunity,
                self.title,
                fallback="trade-opportunity",
                max_length=120,
            )
        self.currency = self.currency.upper()
        if self.is_published and self.review_status == OpportunityReviewStatus.APPROVED:
            self.published_at = self.published_at or timezone.now()
        super().save(*args, **kwargs)

    @property
    def is_expired(self) -> bool:
        return self.valid_until is not None and self.valid_until < timezone.localdate()

    def clean(self) -> None:
        errors: dict[str, str] = {}
        city = self.city
        industry = self.industry
        if self.city_id and city and city.province_id != self.province_id:
            errors["city"] = "شهر باید متعلق به استان انتخاب‌شده باشد."
        if self.required_volume is not None and not self.volume_unit.strip():
            errors["volume_unit"] = "برای ثبت حجم یا ظرفیت، واحد اندازه‌گیری الزامی است."
        if (self.min_value is None) != (self.max_value is None):
            errors["min_value"] = "حداقل و حداکثر ارزش مالی باید با هم ثبت شوند."
        if (self.min_value is not None or self.max_value is not None) and not self.currency.strip():
            errors["currency"] = "برای ثبت ارزش مالی، واحد پول الزامی است."
        if len(self.currency) not in (0, 3) or (
            self.currency and (not self.currency.isascii() or not self.currency.isalpha())
        ):
            errors["currency"] = "واحد پول باید کد سه‌حرفی ISO 4217 باشد."
        if (
            self.product_id
            and self.industry_id
            and industry
            and not industry.products.filter(pk=self.product_id).exists()
        ):
            errors["product"] = "محصول انتخاب‌شده به صنعت انتخابی مرتبط نیست."
        if self.valid_until and self.valid_until < timezone.localdate() and self.is_published:
            errors["valid_until"] = "فرصت منقضی‌شده را نمی‌توان منتشر کرد."
        if self.is_published and self.review_status != OpportunityReviewStatus.APPROVED:
            errors["is_published"] = "پیش از انتشار، فرصت باید توسط مدیر تأیید شود."
        if errors:
            raise ValidationError(errors)
