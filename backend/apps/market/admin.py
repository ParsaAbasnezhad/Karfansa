from django import forms
from django.contrib import admin

from apps.market.models import MarketDataProvider, MarketIndicator, MarketPrice


class MarketDataProviderForm(forms.ModelForm):  # type: ignore[type-arg]
    api_key = forms.CharField(
        required=False,
        widget=forms.PasswordInput(render_value=False),
        help_text="برای حفظ کلید فعلی، این فیلد را خالی بگذارید.",
    )

    class Meta:
        model = MarketDataProvider
        exclude: tuple[str, ...] = ()

    def clean_api_key(self) -> str:
        value = self.cleaned_data.get("api_key")
        if isinstance(value, str) and value:
            return value
        return self.instance.api_key if self.instance.pk else ""


@admin.register(MarketDataProvider)
class MarketDataProviderAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    form = MarketDataProviderForm
    list_display = ("name", "rest_base_url", "is_active", "updated_at")
    list_filter = ("is_active",)


@admin.register(MarketIndicator)
class MarketIndicatorAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    list_display = ("name", "symbol", "category", "currency", "unit", "is_featured", "is_active")
    list_filter = ("category", "is_featured", "is_active")
    search_fields = ("name", "symbol")
    list_editable = ("is_featured", "is_active")


@admin.register(MarketPrice)
class MarketPriceAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    list_display = ("indicator", "value", "change_percent", "observed_at", "source")
    list_filter = ("indicator__category",)
    search_fields = ("indicator__symbol", "indicator__name")
    readonly_fields = ("fetched_at",)
