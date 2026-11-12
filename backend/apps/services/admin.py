from django.contrib import admin, messages
from django.core.exceptions import ValidationError

from .integrations import sync_product_opportunity
from .models import (
    ListingImage,
    ProductInquiry,
    ProductListing,
    ProductSpecification,
    SellerProfile,
    ServiceCategory,
)


class ListingImageInline(admin.TabularInline):  # type: ignore[type-arg]
    model = ListingImage
    extra = 0


class ProductSpecificationInline(admin.TabularInline):  # type: ignore[type-arg]
    model = ProductSpecification
    extra = 0


@admin.register(SellerProfile)
class SellerProfileAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    list_display = ("display_name", "user", "province", "city", "is_public")
    list_filter = ("is_public", "province")
    search_fields = ("display_name", "user__email", "user__phone")
    autocomplete_fields = ("user", "province", "city")
    list_select_related = ("user", "province", "city")


@admin.register(ServiceCategory)
class ServiceCategoryAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    list_display = ("name", "parent", "sort_order", "is_active")
    list_filter = ("is_active", "parent")
    search_fields = ("name", "slug")
    autocomplete_fields = ("parent",)
    prepopulated_fields = {"slug": ("name",)}


@admin.register(ProductListing)
class ProductListingAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    list_display = (
        "title",
        "seller",
        "category",
        "province",
        "status",
        "is_active",
        "created_at",
    )
    list_filter = ("status", "is_active", "sale_mode", "category", "province")
    search_fields = ("title", "description", "seller__display_name", "seller__user__email")
    autocomplete_fields = ("seller", "category", "province", "city", "reviewed_by")
    list_select_related = ("seller", "category", "province", "city")
    readonly_fields = (
        "status",
        "is_active",
        "normalized_title",
        "normalized_description",
        "published_at",
        "reviewed_at",
        "reviewed_by",
        "created_at",
        "updated_at",
    )
    inlines = [ListingImageInline, ProductSpecificationInline]
    actions = ("approve_listings", "reject_listings", "archive_listings")
    fieldsets = (
        ("محصول", {"fields": ("seller", "category", "title", "slug", "description")}),
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

    def save_related(self, request, form, formsets, change) -> None:  # type: ignore[no-untyped-def]
        super().save_related(request, form, formsets, change)
        inline_changed = any(formset.has_changed() for formset in formsets)
        if form.instance.status == ProductListing.Status.APPROVED and (
            inline_changed or getattr(form.instance, "_needs_review_after_related_save", False)
        ):
            form.instance.transition_to(ProductListing.Status.PENDING_REVIEW)
            sync_product_opportunity(form.instance)

    def _moderate(self, request, queryset, status: str, reason: str = "") -> None:  # type: ignore[no-untyped-def]
        changed = 0
        failed = 0
        for listing in queryset:
            try:
                listing.transition_to(status, reviewer=request.user, rejection_reason=reason)
                sync_product_opportunity(listing, reviewer=request.user)
            except ValidationError:
                failed += 1
                continue
            changed += 1
        if failed:
            message = (
                f"{changed} محصول به‌روزرسانی شد؛ {failed} محصول به‌دلیل وضعیت نامعتبر "
                "تغییر نکرد."
            )
        else:
            message = f"{changed} محصول به‌روزرسانی شد."
        self.message_user(
            request,
            message,
            messages.WARNING if failed or not changed else messages.SUCCESS,
        )

    @admin.action(description="تأیید محصول و انتشار آن در بازار و فرصت‌های استانی")
    def approve_listings(self, request, queryset) -> None:  # type: ignore[no-untyped-def]
        self._moderate(request, queryset, ProductListing.Status.APPROVED)

    @admin.action(description="رد محصولات")
    def reject_listings(self, request, queryset) -> None:  # type: ignore[no-untyped-def]
        self._moderate(request, queryset, ProductListing.Status.REJECTED, "ردشده توسط مدیر")

    @admin.action(description="بایگانی محصولات")
    def archive_listings(self, request, queryset) -> None:  # type: ignore[no-untyped-def]
        self._moderate(request, queryset, ProductListing.Status.ARCHIVED)


@admin.register(ListingImage)
class ListingImageAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    list_display = ("listing", "alt_text", "sort_order", "created_at")
    search_fields = ("listing__title", "alt_text")
    autocomplete_fields = ("listing",)


@admin.register(ProductSpecification)
class ProductSpecificationAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    list_display = ("listing", "name", "value", "sort_order")
    search_fields = ("listing__title", "name", "value")
    autocomplete_fields = ("listing",)


@admin.register(ProductInquiry)
class ProductInquiryAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    list_display = ("listing", "buyer", "status", "quantity", "created_at")
    list_filter = ("status", "created_at")
    search_fields = ("listing__title", "buyer__email", "buyer__phone", "message")
    autocomplete_fields = ("listing", "buyer")
    list_select_related = ("listing", "buyer")
