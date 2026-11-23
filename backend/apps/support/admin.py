from django import forms
from django.contrib import admin, messages
from django.db.models import Q
from django.http import HttpRequest

from apps.core.admin import KarfansaModelAdmin, KarfansaTabularInline
from apps.core.errors import ApiError

from .models import SupportTicket, TicketMessage, TicketStatus
from .services import add_internal_note, add_staff_reply, set_ticket_status


class AwaitingStaffFilter(admin.SimpleListFilter):
    title = "در انتظار پاسخ پشتیبانی"
    parameter_name = "awaiting_staff"

    def lookups(self, request: HttpRequest, model_admin: admin.ModelAdmin) -> list[tuple[str, str]]:  # type: ignore[type-arg]
        return [("1", "در انتظار کارشناس"), ("0", "سایر")]

    def queryset(self, request: HttpRequest, queryset):  # type: ignore[no-untyped-def]
        if self.value() == "1":
            return queryset.filter(status__in=[TicketStatus.OPEN, TicketStatus.IN_PROGRESS])
        if self.value() == "0":
            return queryset.exclude(status__in=[TicketStatus.OPEN, TicketStatus.IN_PROGRESS])
        return queryset


class TicketMessageInline(KarfansaTabularInline):  # type: ignore[type-arg]
    model = TicketMessage
    extra = 0
    can_delete = False
    ordering = ("created_at",)
    readonly_fields = (
        "sender",
        "sender_type",
        "message",
        "attachment",
        "is_internal",
        "created_at",
    )
    fields = ("created_at", "sender_type", "sender", "is_internal", "message", "attachment")

    def has_add_permission(self, request: HttpRequest, obj: SupportTicket | None = None) -> bool:
        return False


class SupportTicketAdminForm(forms.ModelForm):  # type: ignore[type-arg]
    staff_reply = forms.CharField(
        label="پاسخ به کاربر",
        required=False,
        widget=forms.Textarea(attrs={"rows": 4, "placeholder": "این متن برای کاربر ارسال می‌شود."}),
    )
    reply_attachment = forms.FileField(label="پیوست پاسخ", required=False)
    internal_note = forms.CharField(
        label="یادداشت داخلی",
        required=False,
        widget=forms.Textarea(
            attrs={"rows": 3, "placeholder": "فقط برای تیم پشتیبانی دیده می‌شود."}
        ),
    )

    class Meta:
        model = SupportTicket
        fields = [
            "subject",
            "category",
            "priority",
            "status",
            "assigned_to",
            "user",
            "contact_name",
            "contact_email",
            "contact_phone",
        ]


@admin.register(SupportTicket)
class SupportTicketAdmin(KarfansaModelAdmin):  # type: ignore[type-arg]
    form = SupportTicketAdminForm
    inlines = [TicketMessageInline]
    list_display = (
        "ticket_number",
        "subject",
        "colored_status",
        "category",
        "priority",
        "contact_email",
        "user",
        "assigned_to",
        "awaiting_staff_flag",
        "last_message_excerpt",
        "last_message_at",
        "created_at",
    )
    list_filter = (
        "status",
        "category",
        "priority",
        "source",
        AwaitingStaffFilter,
        "created_at",
        "assigned_to",
    )
    search_fields = (
        "ticket_number",
        "subject",
        "contact_email",
        "contact_name",
        "contact_phone",
        "user__email",
        "last_message_excerpt",
    )
    autocomplete_fields = ("user", "assigned_to")
    readonly_fields = (
        "ticket_number",
        "source",
        "access_token_hash",
        "last_message_at",
        "last_message_excerpt",
        "user_last_read_at",
        "closed_at",
        "created_at",
        "updated_at",
    )
    date_hierarchy = "created_at"
    list_select_related = ("user", "assigned_to")
    ordering = ("-last_message_at", "-created_at")
    actions = ("mark_in_progress", "mark_waiting_for_user", "mark_closed")
    fieldsets = (
        (
            "تیکت",
            {
                "fields": (
                    "ticket_number",
                    "subject",
                    "category",
                    "priority",
                    "status",
                    "source",
                    "assigned_to",
                )
            },
        ),
        (
            "درخواست‌دهنده",
            {"fields": ("user", "contact_name", "contact_email", "contact_phone")},
        ),
        (
            "پاسخ پشتیبانی",
            {"fields": ("staff_reply", "reply_attachment", "internal_note")},
        ),
        (
            "سوابق",
            {
                "fields": (
                    "last_message_excerpt",
                    "last_message_at",
                    "user_last_read_at",
                    "closed_at",
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )

    def get_queryset(self, request: HttpRequest):  # type: ignore[no-untyped-def]
        return super().get_queryset(request).select_related("user", "assigned_to")

    @admin.display(description="وضعیت")
    def colored_status(self, obj: SupportTicket) -> str:
        return obj.get_status_display()

    @admin.display(description="منتظر کارشناس", boolean=True)
    def awaiting_staff_flag(self, obj: SupportTicket) -> bool:
        return obj.awaiting_staff

    def save_model(self, request, obj, form, change) -> None:  # type: ignore[no-untyped-def]
        desired_status = form.cleaned_data.get("status") or obj.status
        if change:
            obj.status = SupportTicket.objects.only("status").get(pk=obj.pk).status
        super().save_model(request, obj, form, change)
        reply = (form.cleaned_data.get("staff_reply") or "").strip()
        note = (form.cleaned_data.get("internal_note") or "").strip()
        attachment = form.cleaned_data.get("reply_attachment")
        try:
            if reply:
                add_staff_reply(
                    ticket=obj,
                    sender=request.user,
                    message=reply,
                    attachment=attachment,
                )
                obj.refresh_from_db()
            if note:
                add_internal_note(ticket=obj, sender=request.user, message=note)
                obj.refresh_from_db()
            if desired_status != obj.status:
                set_ticket_status(obj, desired_status, actor=request.user)
        except ApiError as exc:
            self.message_user(request, exc.message, level=messages.ERROR)

    def formfield_for_foreignkey(self, db_field, request, **kwargs):  # type: ignore[no-untyped-def]
        if db_field.name == "assigned_to":
            kwargs["queryset"] = db_field.remote_field.model.objects.filter(
                Q(is_staff=True) | Q(is_superuser=True)
            )
        return super().formfield_for_foreignkey(db_field, request, **kwargs)

    def _set_status(self, request, queryset, status: str) -> None:  # type: ignore[no-untyped-def]
        changed = 0
        failed = 0
        for ticket in queryset:
            try:
                set_ticket_status(ticket, status, actor=request.user)
            except Exception:
                failed += 1
                continue
            changed += 1
        self.message_user(
            request,
            f"{changed} تیکت به‌روزرسانی شد" + (f"؛ {failed} مورد نامعتبر بود." if failed else "."),
            messages.WARNING if failed else messages.SUCCESS,
        )

    @admin.action(description="انتقال به در حال بررسی")
    def mark_in_progress(self, request, queryset) -> None:  # type: ignore[no-untyped-def]
        self._set_status(request, queryset, TicketStatus.IN_PROGRESS)

    @admin.action(description="در انتظار پاسخ کاربر")
    def mark_waiting_for_user(self, request, queryset) -> None:  # type: ignore[no-untyped-def]
        self._set_status(request, queryset, TicketStatus.WAITING_FOR_USER)

    @admin.action(description="بستن تیکت‌ها")  # noqa: RUF001
    def mark_closed(self, request, queryset) -> None:  # type: ignore[no-untyped-def]
        self._set_status(request, queryset, TicketStatus.CLOSED)

    def has_add_permission(self, request: HttpRequest) -> bool:
        return False


@admin.register(TicketMessage)
class TicketMessageAdmin(KarfansaModelAdmin):  # type: ignore[type-arg]
    list_display = ("ticket", "sender_type", "is_internal", "short_message", "created_at")
    list_filter = ("sender_type", "is_internal", "created_at")
    search_fields = ("ticket__ticket_number", "message", "sender__email")
    autocomplete_fields = ("ticket", "sender")
    readonly_fields = (
        "ticket",
        "sender",
        "sender_type",
        "message",
        "attachment",
        "is_internal",
        "created_at",
        "updated_at",
    )
    list_select_related = ("ticket", "sender")
    date_hierarchy = "created_at"

    def has_add_permission(self, request: HttpRequest) -> bool:
        return False

    def has_change_permission(self, request: HttpRequest, obj: TicketMessage | None = None) -> bool:
        return False

    @admin.display(description="پیام")
    def short_message(self, obj: TicketMessage) -> str:
        text = obj.message[:80]
        prefix = "[داخلی] " if obj.is_internal else ""
        return f"{prefix}{text}"
