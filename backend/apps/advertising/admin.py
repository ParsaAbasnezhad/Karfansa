from django.contrib import admin

from .models import Advertisement


@admin.register(Advertisement)
class AdvertisementAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "organization",
        "status",
        "created_via",
        "start_at",
        "end_at",
        "created_at",
    )
    list_filter = ("status", "created_via", "created_at")
    search_fields = ("title", "description", "organization__name", "organization__english_name")
    autocomplete_fields = ("organization",)
    list_select_related = ("organization",)
    date_hierarchy = "created_at"
    ordering = ("-created_at",)
    readonly_fields = ("id", "published_at", "created_at", "updated_at")
    fieldsets = (
        ("اطلاعات آگهی", {"fields": ("organization", "title", "slug", "description", "image")}),
        ("نمایش و انتشار", {"fields": ("target_url", "status", "created_via", "published_at")}),
        ("زمان‌بندی", {"fields": ("start_at", "end_at")}),
        ("بررسی", {"fields": ("rejection_reason",)}),
        ("زمان‌ها", {"fields": ("id", "created_at", "updated_at")}),
    )
