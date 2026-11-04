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
