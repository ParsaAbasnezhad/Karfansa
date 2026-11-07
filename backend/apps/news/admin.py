from django.contrib import admin
from .models import News, NewsSource, NewsTopic

#مدیریت منابع خبری و آدرس RSS آن‌ها.

@admin.register(NewsSource)
class NewsSourceAdmin(admin.ModelAdmin):
    list_display = ("name", "rss_url", "is_active", "is_headline_source", "last_fetched_at")
    list_filter = ("is_active", "is_headline_source")
    search_fields = ("name", "rss_url")

#تعریف موضوعات و کلمات کلیدی برای دسته‌بندی خبرها
@admin.register(NewsTopic)
class NewsTopicAdmin(admin.ModelAdmin):
    list_display = ("name", "is_active")
    list_filter = ("is_active",)
    search_fields = ("name",)

#مشاهده، جست‌وجو، فیلتر و انتشار خبرهای دریافت‌شده
@admin.register(News)
class NewsAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "source",
        "topic",
        "score",
        "is_published",
        "is_archived",
        "published_at",
    )

    list_filter = (
        "source",
        "topic",
        "is_published",
        "is_archived",
    )

    search_fields = ("title", "summary")
    readonly_fields = ("fetched_at",)
    date_hierarchy = "published_at"
