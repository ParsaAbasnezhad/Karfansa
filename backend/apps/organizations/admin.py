from django.contrib import admin

from .models import Industry, Organization


@admin.register(Industry)
class IndustryAdmin(admin.ModelAdmin):
    list_display = ("name_fa", "name_en", "slug")
    search_fields = ("name_fa", "name_en", "slug")
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
        "created_at",
    )
    list_filter = (
        "organization_type",
        "industry",
        "country",
        "province",
        "is_verified",
        "is_active",
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
    date_hierarchy = "created_at"
    ordering = ("name",)
    readonly_fields = ("id", "created_at", "updated_at")
    fieldsets = (
        ("اطلاعات شرکت", {"fields": ("name", "english_name", "slug", "organization_type")}),
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
        ("وضعیت", {"fields": ("is_verified", "is_active")}),
        ("زمان‌ها", {"fields": ("id", "created_at", "updated_at")}),
    )
