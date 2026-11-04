from django import forms

from .models import OrganizationNews


class OrganizationNewsForm(forms.ModelForm):
    class Meta:
        model = OrganizationNews
        fields = ["organization", "title", "summary", "content", "image", "source_url"]
