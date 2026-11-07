from django.db import models


class NewsSource(models.Model):
    name = models.CharField(
        max_length=150,
        verbose_name="نام منبع"
    )

    rss_url = models.URLField(
        unique=True,
        verbose_name="آدرس RSS"
    )

    website_url = models.URLField(
        blank=True,
        verbose_name="آدرس سایت"
    )

    is_active = models.BooleanField(
        default=True,
        verbose_name="فعال"
    )

    is_headline_source = models.BooleanField(
        default=False,
        verbose_name="منبع تیترهای مهم"
    )

    last_fetched_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="آخرین دریافت"
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "منبع خبری"
        verbose_name_plural = "منابع خبری"


class NewsTopic(models.Model):
    name = models.CharField(
        max_length=100,
        unique=True,
        verbose_name="موضوع"
    )

    keywords = models.JSONField(
        default=list,
        verbose_name="کلمات کلیدی"
    )

    is_active = models.BooleanField(
        default=True,
        verbose_name="فعال"
    )

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "موضوع خبری"
        verbose_name_plural = "موضوعات خبری"


class News(models.Model):
    source = models.ForeignKey(
        NewsSource,
        on_delete=models.CASCADE,
        related_name="news",
        verbose_name="منبع"
    )

    topic = models.ForeignKey(
        NewsTopic,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="news",
        verbose_name="موضوع"
    )

    title = models.CharField(
        max_length=300,
        verbose_name="عنوان"
    )

    summary = models.TextField(
        blank=True,
        verbose_name="خلاصه"
    )

    original_url = models.URLField(
        max_length=1000,
        unique=True,
        verbose_name="لینک اصلی"
    )

    image_url = models.URLField(
        max_length=1000,
        blank=True,
        verbose_name="تصویر"
    )

    guid = models.CharField(
        max_length=1000,
        blank=True,
        verbose_name="شناسه RSS"
    )

    published_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="تاریخ انتشار"
    )

    fetched_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="تاریخ دریافت"
    )

    score = models.PositiveSmallIntegerField(
        default=0,
        verbose_name="امتیاز ارتباط"
    )

    is_published = models.BooleanField(
        default=False,
        verbose_name="منتشر شده"
    )

    is_archived = models.BooleanField(
        default=False,
        verbose_name="آرشیو شده"
    )

    is_pinned = models.BooleanField(
        default=False,
        verbose_name="خبر ویژه"
    )

    def __str__(self):
        return self.title

    class Meta:
        verbose_name = "خبر"
        verbose_name_plural = "اخبار"
        ordering = ["-published_at"]
        indexes = [
            models.Index(fields=["is_published", "-published_at"]),
            models.Index(fields=["topic", "-published_at"]),
        ]
