from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.contrib.auth.forms import UserChangeForm, UserCreationForm
from django.utils.html import format_html

from apps.core.admin import KarfansaModelAdmin

from .models import User


class AccountCreationForm(UserCreationForm):
    class Meta(UserCreationForm.Meta):
        model = User
        fields = ("email", "phone")


class AccountChangeForm(UserChangeForm):
    class Meta:
        model = User
        fields = "__all__"


@admin.register(User)
class AccountAdmin(KarfansaModelAdmin, DjangoUserAdmin):
    add_form = AccountCreationForm
    form = AccountChangeForm
    model = User
    list_display = (
        "email",
        "first_name",
        "last_name",
        "phone",
        "access_badge",
        "province",
        "date_joined",
    )
    list_filter = ("is_staff", "is_superuser", "is_active", "groups")
    search_fields = ("email", "first_name", "last_name", "phone")
    ordering = ("email",)
    readonly_fields = ("last_login", "date_joined")
    autocomplete_fields = ("province", "city")
    list_select_related = ("province",)
    list_per_page = 30
    list_max_show_all = 100
    show_full_result_count = False
    date_hierarchy = "date_joined"
    save_on_top = True
    filter_horizontal = ("groups", "user_permissions")
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        (
            "اطلاعات هویتی و تماس",
            {"fields": ("first_name", "last_name", "phone", "province", "city")},
        ),
        (
            "دسترسی‌ها",
            {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")},
        ),
        ("زمان‌ها", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("email", "phone", "password1", "password2", "is_staff", "is_active"),
            },
        ),
    )

    @admin.display(description="دسترسی", ordering="is_active")
    def access_badge(self, obj: User) -> str:
        if not obj.is_active:
            label, state = "غیرفعال", "rejected"
        elif obj.is_superuser:
            label, state = "مدیر کل", "approved"
        elif obj.is_staff:
            label, state = "کارمند", "pending"
        else:
            label, state = "کاربر", "neutral"
        return format_html('<span class="ka-status ka-status--{}">{}</span>', state, label)
