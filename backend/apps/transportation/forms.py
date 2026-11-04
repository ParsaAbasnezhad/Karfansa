from django import forms

from .models import TransportCompany


class TransportCompanyForm(forms.ModelForm):
    class Meta:
        model = TransportCompany
        exclude = ["is_verified", "is_active"]
