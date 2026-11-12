from django.contrib import admin

from apps.home.models import AboutPageContent, Slide


@admin.register(Slide)
class SlideAdmin(admin.ModelAdmin):
    list_display = ("title", "is_active", "created_at")
    list_filter = ("is_active",)
    search_fields = ("title", "short_text")


@admin.register(AboutPageContent)
class AboutPageContentAdmin(admin.ModelAdmin):
    fieldsets = (
        ("معرفی", {"fields": ("hero_title", "hero_intro")}),
        ("داستان کارفنسا", {"fields": ("story_title", "story_body")}),
        ("مأموریت", {"fields": ("mission_title", "mission_body")}),
        ("چشم‌انداز", {"fields": ("vision_title", "vision_body")}),
    )
    readonly_fields = ("updated_at",)

    def has_add_permission(self, request):
        return not AboutPageContent.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False
