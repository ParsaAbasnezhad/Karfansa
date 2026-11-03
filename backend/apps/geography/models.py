from django.db import models


class Country(models.Model):
    name_fa = models.CharField(max_length=100)
    name_en = models.CharField(max_length=100)
    iso2 = models.CharField(max_length=2, unique=True, help_text="ISO 3166-1 alpha-2, e.g. IR")

    class Meta:
        ordering = ["name_fa"]
        verbose_name = "کشور"
        verbose_name_plural = "کشورها"

    def __str__(self) -> str:
        return self.name_fa


class Province(models.Model):
    country = models.ForeignKey(Country, on_delete=models.PROTECT, related_name="provinces")
    name_fa = models.CharField(max_length=100)
    name_en = models.CharField(max_length=100)
    slug = models.SlugField(unique=True)

    class Meta:
        ordering = ["name_fa"]
        constraints = [
            models.UniqueConstraint(
                fields=["country", "name_fa"], name="geography_province_unique"
            ),
        ]
        verbose_name = "استان"
        verbose_name_plural = "استان‌ها"

    def __str__(self) -> str:
        return self.name_fa


class City(models.Model):
    province = models.ForeignKey(Province, on_delete=models.PROTECT, related_name="cities")
    name_fa = models.CharField(max_length=100)
    name_en = models.CharField(max_length=100, blank=True)

    class Meta:
        ordering = ["name_fa"]
        constraints = [
            models.UniqueConstraint(fields=["province", "name_fa"], name="geography_city_unique"),
        ]
        verbose_name = "شهر"
        verbose_name_plural = "شهرها"

    def __str__(self) -> str:
        return self.name_fa
