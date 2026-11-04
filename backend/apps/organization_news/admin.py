from django.contrib import admin

from .models import OrganizationNews


@admin.register(OrganizationNews)
class OrganizationNewsAdmin(admin.ModelAdmin):
    list_display = ("title", "organization", "status", "published_at", "created_at")
    list_filter = ("status", "published_at", "created_at")
    search_fields = (
        "title",
        "summary",
        "content",
        "organization__name",
        "organization__english_name",
    )
    autocomplete_fields = ("organization",)
    list_select_related = ("organization",)
    date_hierarchy = "created_at"
    ordering = ("-created_at",)
    readonly_fields = ("id", "published_at", "created_at", "updated_at")
    fieldsets = (
        ("محتوا", {"fields": ("organization", "title", "slug", "summary", "content", "image")}),
        ("منبع", {"fields": ("source_url",)}),
        ("وضعیت انتشار", {"fields": ("status", "published_at")}),
        ("زمان‌ها", {"fields": ("id", "created_at", "updated_at")}),
    )
