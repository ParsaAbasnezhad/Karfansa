from django.contrib import admin

from .models import City, Country, Province


@admin.register(Country)
class CountryAdmin(admin.ModelAdmin):
    list_display = ("name_fa", "name_en", "iso2")
    search_fields = ("name_fa", "name_en", "iso2")
    ordering = ("name_fa",)


@admin.register(Province)
class ProvinceAdmin(admin.ModelAdmin):
    list_display = ("name_fa", "name_en", "slug", "country")
    list_filter = ("country",)
    search_fields = ("name_fa", "name_en", "slug", "country__name_fa", "country__iso2")
    autocomplete_fields = ("country",)
    list_select_related = ("country",)
    ordering = ("country__name_fa", "name_fa")


@admin.register(City)
class CityAdmin(admin.ModelAdmin):
    list_display = ("name_fa", "name_en", "province", "country_name")
    list_filter = ("province__country", "province")
    search_fields = ("name_fa", "name_en", "province__name_fa", "province__country__name_fa")
    autocomplete_fields = ("province",)
    list_select_related = ("province", "province__country")
    ordering = ("province__name_fa", "name_fa")

    @admin.display(description="کشور", ordering="province__country__name_fa")
    def country_name(self, city: City) -> str:
        return city.province.country.name_fa
