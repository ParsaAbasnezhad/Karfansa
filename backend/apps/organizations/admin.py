from django.contrib import admin, messages
from django.core.exceptions import ValidationError

from .business import staff_decide_organization
from .models import (
    BusinessAuditLog,
    Industry,
    Organization,
    OrganizationMember,
    Product,
    VerificationDocument,
)


@admin.register(Industry)
class IndustryAdmin(admin.ModelAdmin):
    list_display = ("name_fa", "name_en", "category", "is_published")
    list_filter = ("category", "is_published")
    search_fields = ("name_fa", "name_en", "slug", "description")
    prepopulated_fields = {"slug": ("name_en",)}
    filter_horizontal = ("products",)
    ordering = ("name_fa",)


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("name_fa", "name_en", "slug")
    search_fields = ("name_fa", "name_en", "slug", "description")
    prepopulated_fields = {"slug": ("name_en",)}
    ordering = ("name_fa",)


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "english_name",
        "organization_type",
        "industry",
        "province",
        "is_verified",
        "is_active",
        "verification_status",
        "created_at",
    )
    list_filter = (
        "organization_type",
        "industry",
        "country",
        "province",
        "is_verified",
        "is_active",
        "verification_status",
    )
    search_fields = (
        "name",
        "english_name",
        "slug",
        "national_id",
        "registration_number",
        "email",
        "phone",
    )
    autocomplete_fields = ("industry", "country", "province", "city")
    list_select_related = ("industry", "country", "province", "city")
    filter_horizontal = ("members",)
    date_hierarchy = "created_at"
    ordering = ("name",)
    readonly_fields = ("id", "created_at", "updated_at", "reviewed_at", "reviewed_by")
    actions = ("approve_organizations", "reject_organizations", "suspend_organizations")
    inlines = []  # replaced after the inline class is defined
    fieldsets = (
        (
            "اطلاعات شرکت",
            {
                "fields": (
                    "name",
                    "english_name",
                    "slug",
                    "organization_type",
                    "ceo_name",
                    "representative_name",
                    "representative_phone",
                    "members",
                )
            },
        ),
        ("رسانه", {"fields": ("logo", "cover_image")}),
        (
            "ثبت و صنعت",
            {"fields": ("national_id", "registration_number", "economic_code", "industry")},
        ),
        ("معرفی", {"fields": ("description", "established_at")}),
        ("موقعیت و نشانی", {"fields": ("country", "province", "city", "address", "postal_code")}),
        (
            "راه‌های ارتباطی",
            {
                "fields": (
                    "phone",
                    "mobile",
                    "email",
                    "website",
                    "whatsapp",
                    "telegram",
                    "linkedin",
                    "instagram",
                )
            },
        ),
        (
            "وضعیت",
            {
                "fields": (
                    "verification_status",
                    "rejection_reason",
                    "is_verified",
                    "is_active",
                    "submitted_at",
                    "reviewed_at",
                    "reviewed_by",
                )
            },
        ),
        ("زمان‌ها", {"fields": ("id", "created_at", "updated_at")}),  # noqa: RUF001
    )

    @admin.action(description="تأیید شرکت‌های انتخاب‌شده")
    def approve_organizations(self, request, queryset) -> None:  # type: ignore[no-untyped-def]
        self._decide(request, queryset, "verified")

    @admin.action(description="رد شرکت‌های انتخاب‌شده")
    def reject_organizations(self, request, queryset) -> None:  # type: ignore[no-untyped-def]
        self._decide(request, queryset, "rejected", "اطلاعات ارسال‌شده کامل یا قابل تأیید نیست.")

    @admin.action(description="تعلیق شرکت‌های انتخاب‌شده")
    def suspend_organizations(self, request, queryset) -> None:  # type: ignore[no-untyped-def]
        self._decide(request, queryset, "suspended")

    def _decide(self, request, queryset, status: str, reason: str = "") -> None:  # type: ignore[no-untyped-def]
        changed = 0
        for organization in queryset:
            try:
                staff_decide_organization(request.user, organization, status, reason)
            except ValidationError:
                continue
            changed += 1
        self.message_user(request, f"{changed} شرکت به‌روزرسانی شد.", messages.SUCCESS)


class OrganizationMemberInline(admin.TabularInline):  # type: ignore[type-arg]
    model = OrganizationMember
    extra = 0
    autocomplete_fields = ("user",)
    readonly_fields = ("created_at", "updated_at")


OrganizationAdmin.inlines = [OrganizationMemberInline]  # type: ignore[attr-defined]


@admin.register(OrganizationMember)
class OrganizationMemberAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    list_display = ("organization", "user", "role", "status", "invitation_status", "created_at")
    list_filter = ("role", "status", "invitation_status")
    search_fields = ("organization__name", "user__email", "user__phone")
    autocomplete_fields = ("organization", "user")
    list_select_related = ("organization", "user")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(VerificationDocument)
class VerificationDocumentAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    list_display = ("document_type", "object_id", "review_status", "uploaded_by", "created_at")
    list_filter = ("document_type", "review_status")
    search_fields = ("object_id", "uploaded_by__email")
    autocomplete_fields = ("uploaded_by", "reviewer")
    readonly_fields = ("stored_name", "created_at", "reviewed_at")

    @admin.display(description="پرونده خصوصی")
    def stored_name(self, obj: VerificationDocument) -> str:
        return obj.file.name


@admin.register(BusinessAuditLog)
class BusinessAuditLogAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    list_display = ("created_at", "action", "actor", "target_type", "target_id")
    list_filter = ("action", "target_type")
    search_fields = ("action", "target_id", "actor__email")
    readonly_fields = ("actor", "action", "target_type", "target_id", "metadata", "created_at")

    def has_add_permission(self, request) -> bool:  # type: ignore[no-untyped-def]
        return False

    def has_change_permission(self, request, obj=None) -> bool:  # type: ignore[no-untyped-def]
        return False
