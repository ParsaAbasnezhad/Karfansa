from django import forms
from django.utils.html import format_html
from unfold.admin import ModelAdmin, TabularInline
from unfold.forms import ActionForm


class KarfansaModelAdmin(ModelAdmin):
    list_per_page = 30
    list_max_show_all = 100
    show_full_result_count = False
    save_on_top = True


KarfansaTabularInline = TabularInline


class ModerationActionForm(ActionForm):
    rejection_reason = forms.CharField(
        label="دلیل رد یا درخواست اصلاح",
        required=False,
        widget=forms.Textarea(attrs={"rows": 2, "class": "vLargeTextField"}),
    )


class ModerationModelAdmin(KarfansaModelAdmin):
    action_form = ModerationActionForm

    def has_moderate_permission(self, request):
        return request.user.has_perm(self.moderation_permission)


def status_badge(label: str, state: str) -> str:
    allowed_states = {"pending", "approved", "rejected", "suspended", "neutral"}
    style = state if state in allowed_states else "neutral"
    return format_html('<span class="ka-status ka-status--{}">{}</span>', style, label)


def image_preview(field, *, alt: str = "پیش‌نمایش تصویر") -> str:
    if not field:
        return "—"
    return format_html(
        '<img class="ka-image-preview" src="{}" alt="{}" loading="lazy">',
        field.url,
        alt,
    )
