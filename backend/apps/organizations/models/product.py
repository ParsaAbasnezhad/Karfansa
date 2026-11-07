from django.db import models


class Product(models.Model):
    name_fa = models.CharField(max_length=160, unique=True, verbose_name="نام فارسی")
    name_en = models.CharField(max_length=160, blank=True, verbose_name="نام انگلیسی")
    slug = models.SlugField(unique=True)
    description = models.TextField(blank=True, verbose_name="توضیحات")

    class Meta:
        ordering = ["name_fa"]
        verbose_name = "محصول"
        verbose_name_plural = "محصولات"

    def __str__(self) -> str:
        return self.name_fa
