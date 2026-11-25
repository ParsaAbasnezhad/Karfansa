from django.contrib import admin

# Persian admin labels are intentional.
# ruff: noqa: RUF001
from django.db.models import Count, Q
from django.urls import reverse
from django.utils.html import format_html

from apps.core.admin import KarfansaModelAdmin
from apps.intents.models import FollowUpStatus, IntentGoal, UserIntent


class GoalFilter(admin.SimpleListFilter):
    title = "هدف"
    parameter_name = "goal"

    def lookups(self, request, model_admin):
        return IntentGoal.choices

    def queryset(self, request, queryset):
        return queryset.filter(goals__contains=[self.value()]) if self.value() else queryset


class PersonTypeFilter(admin.SimpleListFilter):
    title = "نوع کاربر"
    parameter_name = "person_type"

    def lookups(self, request, model_admin):
        return (("guest", "مهمان"), ("account", "ثبت‌نام‌شده"), ("merged", "ادغام‌شده"))

    def queryset(self, request, queryset):
        if self.value() == "guest":
            return queryset.filter(user__isnull=True, merged_into__isnull=True)
        if self.value() == "account":
            return queryset.filter(user__isnull=False)
        if self.value() == "merged":
            return queryset.filter(merged_into__isnull=False)
        return queryset


@admin.register(UserIntent)
class UserIntentAdmin(KarfansaModelAdmin):
    change_list_template = "admin/intents/userintent/change_list.html"
    list_display = (
        "short_id",
        "goals_display",
        "contact_phone",
        "person_type",
        "account_link",
        "contact_consent",
        "follow_up_status",
        "created_at",
        "updated_at",
    )
    list_display_links = ("short_id",)
    list_editable = ("follow_up_status",)
    list_filter = (GoalFilter, PersonTypeFilter, "follow_up_status", "contact_consent")
    search_fields = ("contact_phone", "user__email", "user__phone")
    ordering = ("-created_at",)
    readonly_fields = (
        "id",
        "goals_display",
        "contact_phone",
        "person_type",
        "account_link",
        "contact_consent",
        "consent_at",
        "consent_text_version",
        "guest_token_hash",
        "merged_into",
        "created_at",
        "updated_at",
    )
    fieldsets = (
        (
            "هدف و هویت",
            {"fields": ("id", "goals_display", "person_type", "account_link", "merged_into")},
        ),
        (
            "تماس و رضایت",
            {"fields": ("contact_phone", "contact_consent", "consent_at", "consent_text_version")},
        ),
        ("پیگیری داخلی", {"fields": ("follow_up_status", "admin_note")}),
        ("زمان‌ها", {"fields": ("created_at", "updated_at")}),
    )

    def _can_access(self, request):
        return request.user.is_superuser or request.user.has_perm("intents.view_lead_contact")

    def has_module_permission(self, request):
        return self._can_access(request) and super().has_module_permission(request)

    def has_view_permission(self, request, obj=None):
        return self._can_access(request) and super().has_view_permission(request, obj)

    def has_change_permission(self, request, obj=None):
        return self._can_access(request) and super().has_change_permission(request, obj)

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    @admin.display(description="شناسه")
    def short_id(self, obj):
        return str(obj.pk)[:8]

    @admin.display(description="هدف‌های انتخاب‌شده")
    def goals_display(self, obj):
        labels = dict(IntentGoal.choices)
        return "، ".join(labels.get(goal, goal) for goal in obj.goals)

    @admin.display(description="نوع کاربر")
    def person_type(self, obj):
        if obj.merged_into_id:
            return "ادغام‌شده"
        return "ثبت‌نام‌شده" if obj.user_id else "مهمان"

    @admin.display(description="حساب مرتبط")
    def account_link(self, obj):
        user = obj.user or obj.merged_into
        if user is None:
            return "—"
        url = reverse("admin:accounts_user_change", args=(user.pk,))
        return format_html('<a href="{}">{}</a>', url, user.email)

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("user", "merged_into")

    def changelist_view(self, request, extra_context=None):
        active = UserIntent.objects.filter(merged_into__isnull=True)
        totals = active.aggregate(
            records=Count("pk"),
            users=Count("user", distinct=True),
            guests=Count("pk", filter=Q(user__isnull=True)),
            phones=Count("contact_phone", distinct=True, filter=~Q(contact_phone="")),
            consented=Count("pk", filter=Q(contact_consent=True)),
            needs_follow_up=Count(
                "pk",
                filter=Q(
                    follow_up_status__in=[FollowUpStatus.NEW, FollowUpStatus.REVIEWING],
                    contact_consent=True,
                )
                & ~Q(contact_phone=""),
            ),
        )
        selections = [
            {"label": label, "count": active.filter(goals__contains=[key]).count()}
            for key, label in IntentGoal.choices
        ]
        largest = max((item["count"] for item in selections), default=0)
        for item in selections:
            item["percent"] = round(100 * item["count"] / largest) if largest else 0
        context = {
            **(extra_context or {}),
            "intent_totals": totals,
            "intent_selections": selections,
        }
        return super().changelist_view(request, extra_context=context)
