from django.db import models


class Slide(models.Model):
    title = models.CharField(
        max_length=100,
        verbose_name="عنوان"
    )

    short_text = models.CharField(
        max_length=200,
        verbose_name="متن کوتاه"
    )

    description = models.TextField(
        verbose_name="توضیحات"
    )

    image = models.ImageField(
        upload_to="slides/",
        verbose_name="تصویر"
    )

    is_active = models.BooleanField(
        default=True,
        verbose_name="فعال"
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    class Meta:
        verbose_name = "اسلاید"
        verbose_name_plural = "اسلایدها"
        ordering = ["-created_at"]

    def __str__(self):
        return self.title


class AboutPageContent(models.Model):
    hero_title = models.CharField(max_length=200, verbose_name="عنوان اصلی")
    hero_intro = models.TextField(verbose_name="معرفی کوتاه")
    story_title = models.CharField(max_length=200, verbose_name="عنوان داستان")
    story_body = models.TextField(verbose_name="متن داستان")
    mission_title = models.CharField(max_length=200, verbose_name="عنوان مأموریت")
    mission_body = models.TextField(verbose_name="متن مأموریت")
    vision_title = models.CharField(max_length=200, verbose_name="عنوان چشم‌انداز")
    vision_body = models.TextField(verbose_name="متن چشم‌انداز")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="آخرین ویرایش")

    class Meta:
        verbose_name = "محتوای صفحه درباره ما"
        verbose_name_plural = "محتوای صفحه درباره ما"

    def __str__(self):
        return "محتوای صفحه درباره ما"
