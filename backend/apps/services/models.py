from typing import Any, ClassVar

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from apps.core.slugs import build_unique_slug
from apps.core.uploads import UploadTo
from apps.core.validators import validate_image_extension, validate_image_size
from apps.core.verification import VerificationStatus
from apps.geography.models import City, Province

from .search import normalize_search_text


class SellerProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="seller_profile",
    )
    display_name = models.CharField(max_length=120, verbose_name="نام نمایشی")
    bio = models.TextField(blank=True, max_length=1500, verbose_name="درباره فروشنده")
    professional_title = models.CharField(max_length=120, blank=True, verbose_name="عنوان حرفه‌ای")
    public_phone = models.CharField(max_length=20, blank=True, verbose_name="تلفن عمومی")
    public_email = models.EmailField(blank=True, verbose_name="ایمیل عمومی")
    profile_image = models.ImageField(
        upload_to=UploadTo("services/profiles"),
        blank=True,
        validators=[validate_image_extension, validate_image_size],
        verbose_name="تصویر پروفایل",
    )
    cover_image = models.ImageField(
        upload_to=UploadTo("services/covers"),
        blank=True,
        validators=[validate_image_extension, validate_image_size],
        verbose_name="تصویر پوششی",
    )
    verification_status = models.CharField(
        max_length=20,
        choices=VerificationStatus.choices,
        default=VerificationStatus.DRAFT,
        verbose_name="وضعیت تأیید",
    )
    rejection_reason = models.CharField(max_length=500, blank=True, verbose_name="دلیل رد")
    submitted_at = models.DateTimeField(null=True, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="reviewed_seller_profiles",
    )
    province = models.ForeignKey(
        Province,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="individual_sellers",
        verbose_name="استان",
    )
    city = models.ForeignKey(
        City,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="individual_sellers",
        verbose_name="شهر",
    )
    is_public = models.BooleanField(default=True, verbose_name="نمایش پروفایل")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "پروفایل فروشنده"
        verbose_name_plural = "پروفایل‌های فروشنده"
        indexes = [
            models.Index(fields=["verification_status"], name="svc_seller_verify_idx"),
        ]

    def __str__(self) -> str:
        return self.display_name

    def clean(self) -> None:
        if self.city_id and not self.province_id:
            raise ValidationError({"province": "برای انتخاب شهر، استان را نیز انتخاب کنید."})
        city = self.city
        if self.city_id and self.province_id and city and city.province_id != self.province_id:
            raise ValidationError({"city": "شهر باید متعلق به استان انتخاب‌شده باشد."})


class ServiceCategory(models.Model):
    name = models.CharField(max_length=100, verbose_name="عنوان")
    slug = models.SlugField(max_length=120, unique=True, allow_unicode=True)
    description = models.CharField(max_length=300, blank=True, verbose_name="توضیحات")
    parent = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="children",
        verbose_name="دسته مادر",
    )
    is_active = models.BooleanField(default=True, verbose_name="فعال")
    sort_order = models.PositiveSmallIntegerField(default=0, verbose_name="ترتیب")

    class Meta:
        ordering = ["sort_order", "name"]
        verbose_name = "دسته‌بندی بازار محصولات"
        verbose_name_plural = "دسته‌بندی‌های بازار محصولات"
        indexes = [
            models.Index(fields=["parent", "is_active"], name="svc_cat_parent_active"),
        ]

    def __str__(self) -> str:
        return self.name

    def clean(self) -> None:
        if self.parent_id and self.parent_id == self.pk:
            raise ValidationError({"parent": "یک دسته‌بندی نمی‌تواند والد خودش باشد."})
        if self.pk and self.parent_id and self.parent_id in self.get_descendant_ids():
            raise ValidationError({"parent": "دسته‌بندی نمی‌تواند زیرمجموعه خودش باشد."})

    def get_descendant_ids(self) -> set[int]:
        descendants: set[int] = set()
        frontier = [self.pk] if self.pk else []
        while frontier:
            children = list(
                ServiceCategory.objects.filter(parent_id__in=frontier).values_list("id", flat=True)
            )
            descendants.update(children)
            frontier = children
        return descendants


class ProductListing(models.Model):
    class SaleMode(models.TextChoices):
        DOMESTIC = "domestic", "فروش داخلی"
        EXPORT = "export", "صادرات"
        BOTH = "both", "فروش داخلی و صادرات"

    class Status(models.TextChoices):
        DRAFT = "draft", "پیش‌نویس"
        PENDING_REVIEW = "pending_review", "در انتظار بررسی"
        APPROVED = "approved", "تأییدشده"
        REJECTED = "rejected", "ردشده"
        ARCHIVED = "archived", "بایگانی‌شده"

    class Kind(models.TextChoices):
        PRODUCT = "product", "محصول"
        SERVICE = "service", "خدمت"

    seller = models.ForeignKey(
        SellerProfile,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="listings",
        verbose_name="فروشنده حقیقی",
    )
    organization = models.ForeignKey(
        "organizations.Organization",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="product_listings",
        verbose_name="شرکت مالک",
    )
    listing_kind = models.CharField(
        max_length=16,
        choices=Kind.choices,
        default=Kind.PRODUCT,
        verbose_name="نوع آگهی",
    )
    category = models.ForeignKey(
        ServiceCategory,
        on_delete=models.PROTECT,
        related_name="listings",
        verbose_name="دسته‌بندی",
    )
    province = models.ForeignKey(
        Province, on_delete=models.PROTECT, related_name="product_listings", verbose_name="استان"
    )
    city = models.ForeignKey(
        City,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="product_listings",
        verbose_name="شهر",
    )
    title = models.CharField(max_length=180, verbose_name="نام محصول")
    slug = models.SlugField(max_length=200, unique=True, allow_unicode=True, blank=True)
    description = models.TextField(max_length=5000, verbose_name="معرفی محصول")
    sale_mode = models.CharField(max_length=12, choices=SaleMode.choices, default=SaleMode.BOTH)
    quantity = models.DecimalField(max_digits=20, decimal_places=4, verbose_name="موجودی")
    unit = models.CharField(max_length=40, verbose_name="واحد")
    price = models.DecimalField(
        max_digits=20, decimal_places=2, null=True, blank=True, verbose_name="قیمت واحد"
    )
    currency = models.CharField(max_length=3, blank=True, default="IRR", verbose_name="واحد پول")
    is_price_negotiable = models.BooleanField(default=False, verbose_name="قیمت توافقی")
    minimum_order_quantity = models.DecimalField(
        max_digits=20, decimal_places=4, null=True, blank=True, verbose_name="حداقل سفارش"
    )
    quality = models.CharField(max_length=500, blank=True, verbose_name="کیفیت و درجه‌بندی")
    packaging = models.CharField(max_length=500, blank=True, verbose_name="بسته‌بندی")
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    is_active = models.BooleanField(default=True, verbose_name="فعال")
    rejection_reason = models.CharField(max_length=500, blank=True, verbose_name="دلیل رد")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    published_at = models.DateTimeField(null=True, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="reviewed_product_listings",
    )
    normalized_title = models.CharField(max_length=180, blank=True, editable=False)
    normalized_description = models.TextField(blank=True, editable=False)

    class Meta:
        ordering = ["-published_at", "-created_at"]
        verbose_name = "محصول فروشنده"
        verbose_name_plural = "محصولات فروشندگان"
        constraints = [
            models.CheckConstraint(condition=models.Q(quantity__gt=0), name="svc_qty_positive"),
            models.CheckConstraint(
                condition=models.Q(price__isnull=True) | models.Q(price__gte=0),
                name="svc_price_nonnegative",
            ),
            models.CheckConstraint(
                condition=models.Q(minimum_order_quantity__isnull=True)
                | models.Q(minimum_order_quantity__gt=0),
                name="svc_min_order_positive",
            ),
            models.CheckConstraint(
                condition=~models.Q(status="approved") | models.Q(is_active=True),
                name="svc_approved_active",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(seller__isnull=False, organization__isnull=True)
                    | models.Q(seller__isnull=True, organization__isnull=False)
                ),
                name="svc_listing_one_owner",
            ),
        ]
        indexes = [
            models.Index(
                fields=["status", "is_active", "-published_at"], name="svc_public_list_idx"
            ),
            models.Index(fields=["category", "status"], name="svc_cat_status_idx"),
            models.Index(fields=["province", "city", "status"], name="svc_location_idx"),
            models.Index(fields=["sale_mode", "status"], name="svc_mode_status_idx"),
            models.Index(fields=["organization", "status"], name="svc_org_status_idx"),
            models.Index(fields=["listing_kind", "status"], name="svc_kind_status_idx"),
            models.Index(fields=["price"], name="svc_price_idx"),
            models.Index(fields=["quantity"], name="svc_quantity_idx"),
        ]

    _TRANSITIONS: ClassVar[dict[str, set[str]]] = {
        Status.DRAFT: {Status.PENDING_REVIEW, Status.ARCHIVED},
        Status.PENDING_REVIEW: {Status.APPROVED, Status.REJECTED, Status.DRAFT, Status.ARCHIVED},
        Status.APPROVED: {Status.PENDING_REVIEW, Status.ARCHIVED},
        Status.REJECTED: {Status.DRAFT, Status.PENDING_REVIEW, Status.ARCHIVED},
        Status.ARCHIVED: {Status.DRAFT},
    }

    def __str__(self) -> str:
        return self.title

    def save(self, *args: Any, **kwargs: Any) -> None:
        if self._state.adding:
            if self.status != self.Status.DRAFT:
                raise ValidationError({"status": "محصول جدید باید به‌صورت پیش‌نویس ثبت شود."})
        elif not getattr(self, "_status_transition_allowed", False):
            previous_status = (
                ProductListing.objects.filter(pk=self.pk).values_list("status", flat=True).first()
            )
            if previous_status and previous_status != self.status:
                raise ValidationError(
                    {"status": "برای تغییر وضعیت از گردش کار محصول استفاده کنید."}
                )
        self.normalized_title = normalize_search_text(self.title)
        self.normalized_description = normalize_search_text(self.description)
        if not self.slug:
            self.slug = build_unique_slug(
                ProductListing, self.title, fallback="product", max_length=200
            )
        super().save(*args, **kwargs)

    def transition_to(
        self,
        status: str,
        *,
        reviewer: Any = None,
        rejection_reason: str = "",
    ) -> None:
        if status not in self._TRANSITIONS.get(self.status, set()):
            raise ValidationError(
                {"status": f"تغییر وضعیت از «{self.status}» به «{status}» مجاز نیست."}
            )
        self.status = status
        if status == self.Status.APPROVED:
            self.is_active = True
            self.published_at = timezone.now()
            self.reviewed_at = timezone.now()
            self.reviewed_by = reviewer
            self.rejection_reason = ""
        elif status == self.Status.REJECTED:
            self.is_active = False
            self.reviewed_at = timezone.now()
            self.reviewed_by = reviewer
            self.rejection_reason = rejection_reason.strip()
        elif status in {self.Status.DRAFT, self.Status.PENDING_REVIEW, self.Status.ARCHIVED}:
            self.is_active = status != self.Status.ARCHIVED
            self.published_at = None
            if status == self.Status.PENDING_REVIEW:
                self.reviewed_at = None
                self.reviewed_by = None
                self.rejection_reason = ""
        self._status_transition_allowed = True
        try:
            self.save()
        finally:
            self._status_transition_allowed = False

    def clean(self) -> None:
        errors: dict[str, str] = {}
        if self.city_id and not self.province_id:
            errors["province"] = "برای انتخاب شهر، استان الزامی است."
        if self.city_id and self.city and self.city.province_id != self.province_id:
            errors["city"] = "شهر باید متعلق به استان انتخاب‌شده باشد."
        if self.minimum_order_quantity is not None and self.minimum_order_quantity > self.quantity:
            errors["minimum_order_quantity"] = "حداقل سفارش نمی‌تواند از موجودی بیشتر باشد."
        if self.price is not None and not self.currency:
            errors["currency"] = "برای قیمت، واحد پول الزامی است."
        if self.currency and (
            len(self.currency) != 3 or not self.currency.isascii() or not self.currency.isalpha()
        ):
            errors["currency"] = "واحد پول باید کد سه‌حرفی باشد."
        if self.status == self.Status.APPROVED and not self.is_active:
            errors["status"] = "محصول تأییدشده باید فعال باشد."
        if errors:
            raise ValidationError(errors)

    @property
    def is_export_available(self) -> bool:
        return self.sale_mode in {self.SaleMode.EXPORT, self.SaleMode.BOTH}

    @property
    def is_domestic_available(self) -> bool:
        return self.sale_mode in {self.SaleMode.DOMESTIC, self.SaleMode.BOTH}


class ListingImage(models.Model):
    listing = models.ForeignKey(
        ProductListing, on_delete=models.CASCADE, related_name="images", verbose_name="محصول"
    )
    image = models.ImageField(
        upload_to=UploadTo("services/listings"),
        validators=[validate_image_extension, validate_image_size],
    )
    alt_text = models.CharField(max_length=160, blank=True, verbose_name="متن جایگزین")
    sort_order = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sort_order", "id"]
        verbose_name = "تصویر محصول"
        verbose_name_plural = "تصاویر محصولات"

    def __str__(self) -> str:
        return f"تصویر {self.listing}"


class ProductSpecification(models.Model):
    listing = models.ForeignKey(
        ProductListing,
        on_delete=models.CASCADE,
        related_name="specifications",
        verbose_name="محصول",
    )
    name = models.CharField(max_length=100, verbose_name="ویژگی")
    value = models.CharField(max_length=250, verbose_name="مقدار")
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "id"]
        verbose_name = "مشخصه محصول"
        verbose_name_plural = "مشخصات محصولات"
        constraints = [
            models.UniqueConstraint(fields=["listing", "name"], name="svc_spec_name_unique")
        ]

    def __str__(self) -> str:
        return f"{self.name}: {self.value}"


class ProductInquiry(models.Model):
    class Status(models.TextChoices):
        NEW = "new", "جدید"
        READ = "read", "خوانده‌شده"
        REPLIED = "replied", "پاسخ‌داده‌شده"
        CLOSED = "closed", "بسته‌شده"

    listing = models.ForeignKey(
        ProductListing, on_delete=models.CASCADE, related_name="inquiries", verbose_name="محصول"
    )
    buyer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="product_inquiries",
        verbose_name="خریدار",
    )
    message = models.TextField(max_length=2000, verbose_name="پیام")
    quantity = models.DecimalField(
        max_digits=20, decimal_places=4, null=True, blank=True, verbose_name="مقدار درخواستی"
    )
    status = models.CharField(max_length=8, choices=Status.choices, default=Status.NEW)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "درخواست خرید"
        verbose_name_plural = "درخواست‌های خرید"
        indexes = [
            models.Index(
                fields=["listing", "status", "-created_at"], name="svc_inquiry_status_idx"
            ),
            models.Index(fields=["buyer", "-created_at"], name="svc_inquiry_buyer_idx"),
        ]

    def __str__(self) -> str:
        return f"درخواست {self.listing} از {self.buyer}"

    def clean(self) -> None:
        if self.listing_id and self.buyer_id:
            listing = self.listing
            if listing.seller_id and listing.seller.user_id == self.buyer_id:
                raise ValidationError({"buyer": "نمی‌توانید برای محصول خودتان درخواست بفرستید."})
            if (
                listing.organization_id
                and listing.organization.members.filter(pk=self.buyer_id).exists()
            ):
                raise ValidationError(
                    {"buyer": "نمی‌توانید برای محصول شرکت خودتان درخواست بفرستید."}
                )
        if self.quantity is not None and self.quantity <= 0:
            raise ValidationError({"quantity": "مقدار درخواستی باید بیشتر از صفر باشد."})
