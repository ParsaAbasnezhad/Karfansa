from django import forms
from django.contrib import admin
from django.db import models

from apps.core.admin import KarfansaModelAdmin, KarfansaTabularInline

from .models import AnalysisAttachment, AnalysisAuthor, AnalysisCategory, AnalysisReport


class AnalysisAttachmentInline(KarfansaTabularInline):
    model = AnalysisAttachment
    extra = 1
    formfield_overrides = {models.FileField: {"widget": forms.FileInput}}
    fields = ("file", "original_filename", "file_type", "file_size", "download_count")
    readonly_fields = ("original_filename", "file_type", "file_size", "download_count")


@admin.register(AnalysisCategory)
class AnalysisCategoryAdmin(KarfansaModelAdmin):
    list_display = ("name", "slug", "display_order")
    search_fields = ("name", "slug", "description")
    ordering = ("display_order", "name")


@admin.register(AnalysisAuthor)
class AnalysisAuthorAdmin(KarfansaModelAdmin):
    list_display = ("full_name", "position")
    search_fields = ("full_name", "position")
    ordering = ("full_name",)


@admin.register(AnalysisReport)
class AnalysisReportAdmin(KarfansaModelAdmin):
    formfield_overrides = {
        models.TextField: {"widget": forms.Textarea(attrs={"rows": 24, "dir": "rtl"})},
    }
    list_display = (
        "title",
        "report_type",
        "category",
        "author",
        "status",
        "published_at",
        "is_featured",
        "view_count",
        "download_count",
    )
    list_filter = ("category", "status", "author", "report_type", "is_featured", "published_at")
    search_fields = ("title", "short_description", "slug")
    autocomplete_fields = ("category", "author")
    list_select_related = ("category", "author")
    date_hierarchy = "published_at"
    ordering = ("-published_at", "title")
    readonly_fields = ("id", "created_at", "updated_at", "view_count", "download_count")
    inlines = (AnalysisAttachmentInline,)
    fieldsets = (
        (
            "محتوای گزارش",
            {"fields": ("title", "slug", "short_description", "content", "cover_image")},
        ),
        ("دسته‌بندی و نویسنده", {"fields": ("category", "report_type", "author")}),
        ("انتشار", {"fields": ("status", "published_at", "is_featured")}),
        ("بهینه‌سازی جست‌وجو", {"fields": ("seo_title", "seo_description")}),
        (
            "آمار و زمان‌ها",
            {"fields": ("view_count", "download_count", "id", "created_at", "updated_at")},
        ),
    )


@admin.register(AnalysisAttachment)
class AnalysisAttachmentAdmin(KarfansaModelAdmin):
    formfield_overrides = {models.FileField: {"widget": forms.FileInput}}
    list_display = ("original_filename", "report", "file_type", "file_size", "download_count")
    search_fields = ("original_filename", "report__title")
    list_filter = ("file_type", "created_at")
    list_select_related = ("report",)
    readonly_fields = ("file_type", "file_size", "download_count", "created_at")
