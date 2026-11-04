from django.contrib import admin

from .models import TransportCompany, TransportMode, VehicleType


@admin.register(TransportMode)
class TransportModeAdmin(admin.ModelAdmin):
    list_display = ("name_fa", "name_en", "code", "sort_order")
    search_fields = ("name_fa", "name_en", "code")
    ordering = ("sort_order", "name_fa")


@admin.register(VehicleType)
class VehicleTypeAdmin(admin.ModelAdmin):
    list_display = ("name_fa", "name_en", "slug", "mode")
    list_filter = ("mode",)
    search_fields = ("name_fa", "name_en", "slug", "mode__name_fa")
    autocomplete_fields = ("mode",)
    list_select_related = ("mode",)
    ordering = ("name_fa",)


@admin.register(TransportCompany)
class TransportCompanyAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "english_name",
        "is_verified",
        "is_active",
        "tracking_available",
        "insurance_available",
        "customs_services",
        "created_at",
    )
    list_filter = (
        "is_verified",
        "is_active",
        "tracking_available",
        "insurance_available",
        "customs_services",
        "transport_types",
        "country",
        "province",
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
    autocomplete_fields = (
        "transport_types",
        "vehicle_types",
        "service_provinces",
        "origin_countries",
        "destination_countries",
        "country",
        "province",
        "city",
    )
    list_select_related = ("country", "province", "city")
    date_hierarchy = "created_at"
    ordering = ("name",)
    readonly_fields = ("id", "created_at", "updated_at")
    fieldsets = (
        (
            "اطلاعات شرکت",
            {"fields": ("name", "english_name", "slug", "national_id", "registration_number")},
        ),
        ("رسانه و معرفی", {"fields": ("logo", "cover_image", "description")}),
        ("خدمات حمل‌ونقل", {"fields": ("transport_types", "vehicle_types", "fleet_capacity")}),
        (
            "محدوده خدمات",
            {"fields": ("service_provinces", "origin_countries", "destination_countries")},
        ),
        ("امکانات", {"fields": ("tracking_available", "insurance_available", "customs_services")}),
        ("موقعیت و نشانی", {"fields": ("country", "province", "city", "address")}),
        (
            "راه‌های ارتباطی",
            {"fields": ("phone", "mobile", "email", "website", "whatsapp", "telegram")},
        ),
        ("وضعیت", {"fields": ("is_verified", "is_active")}),
        ("زمان‌ها", {"fields": ("id", "created_at", "updated_at")}),
    )
