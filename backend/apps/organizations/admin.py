from django.contrib import admin, messages
from django.core.exceptions import ValidationError
from django.http import FileResponse, Http404, HttpResponseForbidden
from django.urls import path, reverse
from django.utils.html import format_html

from apps.core.admin import (
    KarfansaModelAdmin,
    KarfansaTabularInline,
    ModerationModelAdmin,
    image_preview,
    status_badge,
)

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
class IndustryAdmin(KarfansaModelAdmin):
    list_display = ("name_fa", "name_en", "category", "is_published")
    list_filter = ("category", "is_published")
    search_fields = ("name_fa", "name_en", "slug", "description")
    prepopulated_fields = {"slug": ("name_en",)}
    filter_horizontal = ("products",)
    ordering = ("name_fa",)


@admin.register(Product)
class ProductAdmin(KarfansaModelAdmin):
    list_display = ("name_fa", "name_en", "slug")
    search_fields = ("name_fa", "name_en", "slug", "description")
    prepopulated_fields = {"slug": ("name_en",)}
    ordering = ("name_fa",)


@admin.register(Organization)
class OrganizationAdmin(ModerationModelAdmin):
    moderation_permission = "organizations.moderate_organization"
    list_display = (
        "name",
        "english_name",
        "organization_type",
        "industry",
        "province",
        "verification_badge",
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
    readonly_fields = (
        "logo_preview",
        "cover_preview",
        "verification_badge",
        "verification_status",
        "rejection_reason",
        "is_verified",
        "is_active",
        "id",
        "created_at",
        "updated_at",
        "reviewed_at",
        "reviewed_by",
    )
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
        ("رسانه", {"fields": ("logo_preview", "logo", "cover_preview", "cover_image")}),
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
                    "verification_badge",
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
        ("زمان‌ها", {"fields": ("id", "created_at", "updated_at")}),
    )

    @admin.display(description="وضعیت بررسی", ordering="verification_status")
    def verification_badge(self, obj: Organization) -> str:
        states = {
            "pending_review": "pending",
            "verified": "approved",
            "rejected": "rejected",
            "suspended": "suspended",
        }
        return status_badge(
            obj.get_verification_status_display(),
            states.get(obj.verification_status, "neutral"),
        )

    @admin.display(description="لوگو")
    def logo_preview(self, obj: Organization) -> str:
        return image_preview(obj.logo, alt=f"لوگوی {obj.name}")

    @admin.display(description="تصویر پوششی")
    def cover_preview(self, obj: Organization) -> str:
        return image_preview(obj.cover_image, alt=f"تصویر پوششی {obj.name}")

    @admin.action(description="تأیید شرکت‌های انتخاب‌شده", permissions=["moderate"])
    def approve_organizations(self, request, queryset) -> None:  # type: ignore[no-untyped-def]
        self._decide(request, queryset, "verified")

    @admin.action(description="رد شرکت‌های انتخاب‌شده", permissions=["moderate"])
    def reject_organizations(self, request, queryset) -> None:  # type: ignore[no-untyped-def]
        reason = request.POST.get("rejection_reason", "").strip()
        if not reason:
            self.message_user(request, "برای رد شرکت، دلیل رد را وارد کنید.", messages.ERROR)
            return
        self._decide(request, queryset, "rejected", reason)

    @admin.action(description="تعلیق شرکت‌های انتخاب‌شده", permissions=["moderate"])
    def suspend_organizations(self, request, queryset) -> None:  # type: ignore[no-untyped-def]
        self._decide(request, queryset, "suspended")

    def _decide(self, request, queryset, status: str, reason: str = "") -> None:  # type: ignore[no-untyped-def]
        changed = failed = 0
        for organization in queryset:
            try:
                staff_decide_organization(request.user, organization, status, reason)
            except ValidationError:
                failed += 1
                continue
            changed += 1
        message = f"{changed} شرکت به‌روزرسانی شد."
        if failed:
            message += f" {failed} مورد به‌دلیل وضعیت یا مجوز نامعتبر تغییر نکرد."
        self.message_user(request, message, messages.WARNING if failed else messages.SUCCESS)


class OrganizationMemberInline(KarfansaTabularInline):  # type: ignore[type-arg]
    model = OrganizationMember
    extra = 0
    autocomplete_fields = ("user",)
    readonly_fields = ("created_at", "updated_at")


OrganizationAdmin.inlines = [OrganizationMemberInline]  # type: ignore[attr-defined]


@admin.register(OrganizationMember)
class OrganizationMemberAdmin(KarfansaModelAdmin):  # type: ignore[type-arg]
    list_display = ("organization", "user", "role", "status", "invitation_status", "created_at")
    list_filter = ("role", "status", "invitation_status")
    search_fields = ("organization__name", "user__email", "user__phone")
    autocomplete_fields = ("organization", "user")
    list_select_related = ("organization", "user")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(VerificationDocument)
class VerificationDocumentAdmin(KarfansaModelAdmin):  # type: ignore[type-arg]
    list_display = ("document_type", "object_id", "review_status", "uploaded_by", "created_at")
    list_filter = ("document_type", "review_status")
    search_fields = ("object_id", "uploaded_by__email")
    readonly_fields = (
        "document_type",
        "content_type",
        "object_id",
        "file_download",
        "review_status",
        "rejection_reason",
        "uploaded_by",
        "reviewer",
        "created_at",
        "reviewed_at",
    )
    fields = readonly_fields
    list_select_related = ("content_type", "uploaded_by", "reviewer")
    date_hierarchy = "created_at"

    def has_add_permission(self, request) -> bool:  # type: ignore[no-untyped-def]
        return False

    def has_delete_permission(self, request, obj=None) -> bool:  # type: ignore[no-untyped-def]
        return False

    def get_urls(self):
        custom_urls = [
            path(
                "<path:object_id>/download/",
                self.admin_site.admin_view(self.download_document),
                name="organizations_verificationdocument_download",
            ),
        ]
        return custom_urls + super().get_urls()

    def download_document(self, request, object_id: str):  # type: ignore[no-untyped-def]
        if not (
            request.user.has_perm("organizations.view_verificationdocument")
            or request.user.has_perm("organizations.moderate_organization")
        ):
            return HttpResponseForbidden()
        document = self.get_object(request, object_id)
        if document is None:
            raise Http404
        return FileResponse(
            document.file.open("rb"),
            as_attachment=True,
            filename=document.file.name.rsplit("/", 1)[-1],
        )

    @admin.display(description="پرونده خصوصی")
    def file_download(self, obj: VerificationDocument) -> str:
        url = reverse(
            "admin:organizations_verificationdocument_download",
            args=(obj.pk,),
        )
        return format_html('<a href="{}">دریافت فایل خصوصی</a>', url)


@admin.register(BusinessAuditLog)
class BusinessAuditLogAdmin(KarfansaModelAdmin):  # type: ignore[type-arg]
    list_display = ("created_at", "action", "actor", "target_type", "target_id")
    list_filter = ("action", "target_type")
    search_fields = ("action", "target_id", "actor__email")
    readonly_fields = ("actor", "action", "target_type", "target_id", "metadata", "created_at")

    def has_add_permission(self, request) -> bool:  # type: ignore[no-untyped-def]
        return False

    def has_change_permission(self, request, obj=None) -> bool:  # type: ignore[no-untyped-def]
        return False

    def has_delete_permission(self, request, obj=None) -> bool:  # type: ignore[no-untyped-def]
        return False
