from django import forms

from .models import City, Country, Province


class CountryForm(forms.ModelForm):
    class Meta:
        model = Country
        fields = ["name_fa", "name_en", "iso2"]


class ProvinceForm(forms.ModelForm):
    class Meta:
        model = Province
        fields = ["country", "name_fa", "name_en", "slug"]


class CityForm(forms.ModelForm):
    class Meta:
        model = City
        fields = ["province", "name_fa", "name_en"]
