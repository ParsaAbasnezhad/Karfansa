from django.contrib import admin

from .forms import ProvinceIndustryForm
from .models import City, Country, Province, ProvinceIndustry


class ProvinceIndustryInline(admin.TabularInline):
    model = ProvinceIndustry
    form = ProvinceIndustryForm
    extra = 0
    autocomplete_fields = ("industry", "active_cities")


@admin.register(Country)
class CountryAdmin(admin.ModelAdmin):
    list_display = ("name_fa", "name_en", "iso2")
    search_fields = ("name_fa", "name_en", "iso2")
    ordering = ("name_fa",)


@admin.register(Province)
class ProvinceAdmin(admin.ModelAdmin):
    list_display = ("name_fa", "name_en", "capital", "is_published", "country")
    list_filter = ("is_published", "country")
    search_fields = (
        "name_fa",
        "name_en",
        "slug",
        "country__name_fa",
        "country__iso2",
        "capital__name_fa",
    )
    autocomplete_fields = ("country", "capital")
    list_select_related = ("country", "capital")
    ordering = ("country__name_fa", "name_fa")
    fieldsets = (
        ("اطلاعات پایه", {"fields": ("country", "name_fa", "name_en", "slug", "capital")}),
        ("معرفی استان", {"fields": ("short_description", "description", "economic_description")}),
        ("آمار و موقعیت", {"fields": ("area_sq_km", "population", "latitude", "longitude")}),
        ("تصاویر", {"fields": ("featured_image", "map_image")}),
        ("انتشار", {"fields": ("is_published", "created_at", "updated_at")}),
    )
    readonly_fields = ("created_at", "updated_at")
    inlines = (ProvinceIndustryInline,)


@admin.register(ProvinceIndustry)
class ProvinceIndustryAdmin(admin.ModelAdmin):
    form = ProvinceIndustryForm
    list_display = (
        "industry",
        "province",
        "activity_level",
        "production_capacity",
        "updated_year",
    )
    list_filter = ("industry__category", "activity_level", "province__country", "province")
    search_fields = (
        "industry__name_fa",
        "industry__name_en",
        "province__name_fa",
        "description",
        "competitive_advantage",
        "source",
    )
    autocomplete_fields = ("province", "industry", "active_cities")
    list_select_related = ("province", "industry")
    filter_horizontal = ("active_cities",)


@admin.register(City)
class CityAdmin(admin.ModelAdmin):
    list_display = ("name_fa", "name_en", "province", "is_county_center", "country_name")
    list_filter = ("province__country", "province", "is_county_center")
    search_fields = (
        "name_fa",
        "name_en",
        "slug",
        "province__name_fa",
        "province__country__name_fa",
    )
    autocomplete_fields = ("province",)
    list_select_related = ("province", "province__country")
    ordering = ("province__name_fa", "name_fa")
    list_editable = ("is_county_center",)

    @admin.display(description="کشور", ordering="province__country__name_fa")
    def country_name(self, city: City) -> str:
        return city.province.country.name_fa
