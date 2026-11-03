from django.db import models


class Industry(models.Model):
    name_fa = models.CharField(max_length=120, unique=True)
    name_en = models.CharField(max_length=120, blank=True)
    slug = models.SlugField(unique=True)

    class Meta:
        ordering = ["name_fa"]
        verbose_name = "صنعت"
        verbose_name_plural = "صنایع"

    def __str__(self) -> str:
        return self.name_fa
