from typing import Any

from django import forms

from .models import City, Country, Province, ProvinceIndustry


class CountryForm(forms.ModelForm):
    class Meta:
        model = Country
        fields = ["name_fa", "name_en", "iso2"]


class ProvinceForm(forms.ModelForm):
    class Meta:
        model = Province
        fields = [
            "country",
            "name_fa",
            "name_en",
            "slug",
            "capital",
            "short_description",
            "description",
            "economic_description",
            "area_sq_km",
            "population",
            "latitude",
            "longitude",
            "featured_image",
            "map_image",
            "is_published",
        ]


class CityForm(forms.ModelForm):
    class Meta:
        model = City
        fields = [
            "province",
            "name_fa",
            "name_en",
            "slug",
            "population",
            "description",
            "is_county_center",
            "latitude",
            "longitude",
        ]


class ProvinceIndustryForm(forms.ModelForm):
    class Meta:
        model = ProvinceIndustry
        fields = [
            "province",
            "industry",
            "description",
            "activity_level",
            "production_capacity",
            "production_capacity_unit",
            "active_cities",
            "competitive_advantage",
            "source",
            "source_url",
            "updated_year",
        ]

    def clean(self) -> dict[str, Any]:
        cleaned_data = super().clean()
        if cleaned_data is None:
            return {}
        province = cleaned_data.get("province") or self.instance.province
        cities = cleaned_data.get("active_cities")
        if province and cities and cities.exclude(province=province).exists():
            self.add_error("active_cities", "شهرهای فعال باید متعلق به استان انتخاب‌شده باشند.")
        return cleaned_data
