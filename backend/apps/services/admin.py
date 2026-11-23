from django.contrib import admin, messages
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.core.admin import (
    KarfansaModelAdmin,
    KarfansaTabularInline,
    ModerationModelAdmin,
    image_preview,
    status_badge,
)
from apps.organizations.audit import audit
from apps.organizations.business import staff_decide_individual

from .integrations import sync_product_opportunity
from .models import (
    ListingImage,
    ProductInquiry,
    ProductListing,
    ProductSpecification,
    SellerProfile,
    ServiceCategory,
)


class ListingImageInline(KarfansaTabularInline):  # type: ignore[type-arg]
    model = ListingImage
    extra = 0


class ProductSpecificationInline(KarfansaTabularInline):  # type: ignore[type-arg]
    model = ProductSpecification
    extra = 0


@admin.register(SellerProfile)
class SellerProfileAdmin(ModerationModelAdmin):  # type: ignore[type-arg]
    moderation_permission = "services.moderate_sellerprofile"
    list_display = (
        "display_name",
        "user",
        "province",
        "city",
        "is_public",
        "verification_badge",
        "submitted_at",
    )
    list_filter = ("is_public", "province", "verification_status")
    search_fields = ("display_name", "user__email", "user__phone", "professional_title")
    readonly_fields = (
        "profile_preview",
        "cover_preview",
        "verification_status",
        "rejection_reason",
        "submitted_at",
        "reviewed_at",
        "reviewed_by",
        "created_at",
        "updated_at",
    )
    actions = ("approve_profiles", "reject_profiles", "suspend_profiles")
    autocomplete_fields = ("user", "province", "city")
    list_select_related = ("user", "province", "city")
    fieldsets = (
        ("پروفایل", {"fields": ("user", "display_name", "professional_title", "bio")}),
        (
            "تصاویر",
            {"fields": ("profile_preview", "profile_image", "cover_preview", "cover_image")},
        ),
        ("راه‌های ارتباطی", {"fields": ("public_phone", "public_email")}),
        ("موقعیت", {"fields": ("province", "city", "is_public")}),
        (
            "بررسی",
            {
                "fields": (
                    "verification_status",
                    "rejection_reason",
                    "submitted_at",
                    "reviewed_at",
                    "reviewed_by",
                )
            },
        ),
        ("زمان‌ها", {"fields": ("created_at", "updated_at")}),
    )

    @admin.display(description="وضعیت بررسی", ordering="verification_status")
    def verification_badge(self, obj: SellerProfile) -> str:
        states = {
            "verified": "approved",
            "pending_review": "pending",
            "rejected": "rejected",
            "suspended": "suspended",
        }
        return status_badge(
            obj.get_verification_status_display(),
            states.get(obj.verification_status, "neutral"),
        )

    @admin.display(description="تصویر پروفایل")
    def profile_preview(self, obj: SellerProfile) -> str:
        return image_preview(obj.profile_image, alt="تصویر پروفایل فروشنده")

    @admin.display(description="تصویر پوششی")
    def cover_preview(self, obj: SellerProfile) -> str:
        return image_preview(obj.cover_image, alt="تصویر پوششی فروشنده")

    @admin.action(description="تأیید پروفایل‌های فردی", permissions=["moderate"])
    def approve_profiles(self, request, queryset) -> None:  # type: ignore[no-untyped-def]
        self._decide(request, queryset, "verified")

    @admin.action(description="رد پروفایل‌های فردی", permissions=["moderate"])
    def reject_profiles(self, request, queryset) -> None:  # type: ignore[no-untyped-def]
        reason = self._rejection_reason(request)
        if reason is not None:
            self._decide(request, queryset, "rejected", reason)

    @admin.action(description="تعلیق پروفایل‌های فردی", permissions=["moderate"])
    def suspend_profiles(self, request, queryset) -> None:  # type: ignore[no-untyped-def]
        self._decide(request, queryset, "suspended")

    def _rejection_reason(self, request) -> str | None:  # type: ignore[no-untyped-def]
        reason = request.POST.get("rejection_reason", "").strip()
        if not reason:
            self.message_user(request, "برای رد پروفایل، دلیل رد را وارد کنید.", messages.ERROR)
            return None
        return reason

    def _decide(self, request, queryset, status: str, reason: str = "") -> None:  # type: ignore[no-untyped-def]
        changed = failed = 0
        for profile in queryset:
            try:
                with transaction.atomic():
                    staff_decide_individual(request.user, profile, status, reason)
            except ValidationError:
                failed += 1
                continue
            changed += 1
        message = f"{changed} پروفایل به‌روزرسانی شد."
        if failed:
            message += f" {failed} مورد به‌دلیل وضعیت یا مجوز نامعتبر تغییر نکرد."
        self.message_user(request, message, messages.WARNING if failed else messages.SUCCESS)


@admin.register(ServiceCategory)
class ServiceCategoryAdmin(KarfansaModelAdmin):  # type: ignore[type-arg]
    list_display = ("name", "parent", "sort_order", "is_active")
    list_filter = ("is_active", "parent")
    search_fields = ("name", "slug")
    autocomplete_fields = ("parent",)
    prepopulated_fields = {"slug": ("name",)}


@admin.register(ProductListing)
class ProductListingAdmin(ModerationModelAdmin):  # type: ignore[type-arg]
    moderation_permission = "services.moderate_productlisting"
    list_display = (
        "thumbnail",
        "title",
        "seller",
        "organization",
        "listing_kind",
        "category",
        "province",
        "status_badge",
        "is_active",
        "created_at",
    )
    list_filter = ("status", "listing_kind", "is_active", "sale_mode", "category", "province")
    search_fields = (
        "title",
        "description",
        "seller__display_name",
        "seller__user__email",
        "organization__name",
    )
    autocomplete_fields = ("seller", "organization", "category", "province", "city", "reviewed_by")
    list_select_related = ("seller", "category", "province", "city")
    readonly_fields = (
        "thumbnail",
        "status",
        "is_active",
        "rejection_reason",
        "normalized_title",
        "normalized_description",
        "published_at",
        "reviewed_at",
        "reviewed_by",
        "created_at",
        "updated_at",
    )
    inlines = [ListingImageInline, ProductSpecificationInline]
    actions = (
        "approve_listings",
        "reject_listings",
        "request_changes",
        "unpublish_listings",
        "archive_listings",
    )
    fieldsets = (
        (
            "محصول",
            {
                "fields": (
                    "thumbnail",
                    "seller",
                    "organization",
                    "listing_kind",
                    "category",
                    "title",
                    "slug",
                    "description",
                )
            },
        ),
        ("موقعیت و فروش", {"fields": ("province", "city", "sale_mode", "quantity", "unit")}),
        (
            "قیمت و سفارش",
            {"fields": ("price", "currency", "is_price_negotiable", "minimum_order_quantity")},
        ),
        ("کیفیت و بسته‌بندی", {"fields": ("quality", "packaging")}),
        (
            "بررسی",
            {"fields": ("status", "is_active", "rejection_reason", "reviewed_at", "reviewed_by")},
        ),
        ("سوابق", {"fields": ("created_at", "updated_at", "published_at")}),
    )

    def save_model(self, request, obj, form, change) -> None:  # type: ignore[no-untyped-def]
        needs_review = False
        if change:
            original = ProductListing.objects.get(pk=obj.pk)
            needs_review = original.status == ProductListing.Status.APPROVED and bool(
                set(form.changed_data) - {"rejection_reason"}
            )
        obj._needs_review_after_related_save = needs_review
        super().save_model(request, obj, form, change)

    def get_queryset(self, request):  # type: ignore[no-untyped-def]
        return (
            super()
            .get_queryset(request)
            .select_related("seller__user", "organization", "category", "province", "city")
            .prefetch_related("images")
        )

    @admin.display(description="تصویر")
    def thumbnail(self, obj: ProductListing) -> str:
        image = next(iter(obj.images.all()), None)
        return image_preview(image.image, alt=f"تصویر {obj.title}") if image else "—"

    @admin.display(description="وضعیت", ordering="status")
    def status_badge(self, obj: ProductListing) -> str:
        states = {
            ProductListing.Status.PENDING_REVIEW: "pending",
            ProductListing.Status.APPROVED: "approved",
            ProductListing.Status.REJECTED: "rejected",
        }
        return status_badge(obj.get_status_display(), states.get(obj.status, "neutral"))

    def save_related(self, request, form, formsets, change) -> None:  # type: ignore[no-untyped-def]
        super().save_related(request, form, formsets, change)
        inline_changed = any(formset.has_changed() for formset in formsets)
        if form.instance.status == ProductListing.Status.APPROVED and (
            inline_changed or getattr(form.instance, "_needs_review_after_related_save", False)
        ):
            form.instance.transition_to(ProductListing.Status.PENDING_REVIEW)
            sync_product_opportunity(form.instance)
            audit(request.user, "listing.content_revised", form.instance)

    def _moderate(self, request, queryset, status: str, reason: str = "") -> None:  # type: ignore[no-untyped-def]
        changed = 0
        failed = 0
        for listing in queryset:
            try:
                with transaction.atomic():
                    listing.transition_to(status, reviewer=request.user, rejection_reason=reason)
                    sync_product_opportunity(listing, reviewer=request.user)
                    audit(
                        request.user,
                        f"listing.{status}",
                        listing,
                        status=status,
                        reason=reason,
                    )
            except ValidationError:
                failed += 1
                continue
            changed += 1
        if failed:
            message = (
                f"{changed} محصول به‌روزرسانی شد؛ {failed} محصول به‌دلیل وضعیت نامعتبر تغییر نکرد."
            )
        else:
            message = f"{changed} محصول به‌روزرسانی شد."
        self.message_user(
            request,
            message,
            messages.WARNING if failed or not changed else messages.SUCCESS,
        )

    @admin.action(
        description="تأیید محصول و انتشار آن در بازار و فرصت‌های استانی",
        permissions=["moderate"],
    )
    def approve_listings(self, request, queryset) -> None:  # type: ignore[no-untyped-def]
        self._moderate(request, queryset, ProductListing.Status.APPROVED)

    @admin.action(description="رد محصولات", permissions=["moderate"])
    def reject_listings(self, request, queryset) -> None:  # type: ignore[no-untyped-def]
        reason = self._rejection_reason(request)
        if reason is not None:
            self._moderate(request, queryset, ProductListing.Status.REJECTED, reason)

    @admin.action(description="درخواست اصلاح از ثبت‌کننده", permissions=["moderate"])
    def request_changes(self, request, queryset) -> None:  # type: ignore[no-untyped-def]
        reason = self._rejection_reason(request)
        if reason is None:
            return
        changed = failed = 0
        for listing in queryset:
            if listing.status != ProductListing.Status.PENDING_REVIEW:
                failed += 1
                continue
            try:
                listing.transition_to(ProductListing.Status.DRAFT)
                listing.rejection_reason = reason
                listing.reviewed_at = timezone.now()
                listing.reviewed_by = request.user
                listing.save(
                    update_fields=[
                        "rejection_reason",
                        "reviewed_at",
                        "reviewed_by",
                        "updated_at",
                    ]
                )
                sync_product_opportunity(listing, reviewer=request.user)
                audit(request.user, "listing.changes_requested", listing, reason=reason)
            except ValidationError:
                failed += 1
                continue
            changed += 1
        self._report_moderation(request, changed, failed)

    @admin.action(description="لغو انتشار محصولات انتخاب‌شده", permissions=["moderate"])
    def unpublish_listings(self, request, queryset) -> None:  # type: ignore[no-untyped-def]
        self._moderate(request, queryset, ProductListing.Status.ARCHIVED)

    @admin.action(description="بایگانی محصولات", permissions=["moderate"])
    def archive_listings(self, request, queryset) -> None:  # type: ignore[no-untyped-def]
        self._moderate(request, queryset, ProductListing.Status.ARCHIVED)

    def _report_moderation(self, request, changed: int, failed: int) -> None:  # type: ignore[no-untyped-def]
        message = f"{changed} محصول به‌روزرسانی شد."
        if failed:
            message += f" {failed} مورد به‌دلیل وضعیت نامعتبر تغییر نکرد."
        self.message_user(request, message, messages.WARNING if failed else messages.SUCCESS)

    def _rejection_reason(self, request) -> str | None:  # type: ignore[no-untyped-def]
        reason = request.POST.get("rejection_reason", "").strip()
        if not reason:
            self.message_user(
                request,
                "برای این اقدام، دلیل رد یا اصلاح را وارد کنید.",
                messages.ERROR,
            )
            return None
        return reason


@admin.register(ListingImage)
class ListingImageAdmin(KarfansaModelAdmin):  # type: ignore[type-arg]
    list_display = ("listing", "alt_text", "sort_order", "created_at")
    search_fields = ("listing__title", "alt_text")
    autocomplete_fields = ("listing",)


@admin.register(ProductSpecification)
class ProductSpecificationAdmin(KarfansaModelAdmin):  # type: ignore[type-arg]
    list_display = ("listing", "name", "value", "sort_order")
    search_fields = ("listing__title", "name", "value")
    autocomplete_fields = ("listing",)


@admin.register(ProductInquiry)
class ProductInquiryAdmin(KarfansaModelAdmin):  # type: ignore[type-arg]
    list_display = ("listing", "buyer", "status", "quantity", "created_at")
    list_filter = ("status", "created_at")
    search_fields = ("listing__title", "buyer__email", "buyer__phone", "message")
    autocomplete_fields = ("listing", "buyer")
    list_select_related = ("listing", "buyer")
    list_per_page = 30
