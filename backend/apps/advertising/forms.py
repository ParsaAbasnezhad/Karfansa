from django import forms

from .models import Advertisement


class AdvertisementForm(forms.ModelForm):
    class Meta:
        model = Advertisement
        fields = ["organization", "title", "description", "image", "target_url", "start_at", "end_at"]
