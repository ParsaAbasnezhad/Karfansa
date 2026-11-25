from datetime import timedelta

from django.contrib import admin, messages
from django.db import transaction
from django.utils import timezone
from django.utils.html import format_html

from apps.core.admin import ModerationModelAdmin, status_badge
from apps.organizations.audit import audit

from .models import (
    OpportunityLevel,
    OpportunityReviewStatus,
    TradeOpportunity,
)


@admin.register(TradeOpportunity)
class TradeOpportunityAdmin(ModerationModelAdmin):  # type: ignore[type-arg]
    moderation_permission = "trade.moderate_tradeopportunity"

    # --------------------------------------------------
    # List configuration
    # --------------------------------------------------

    list_display = (
        "title",
        "opportunity_type",
        "level_badge",
        "province",
        "product",
        "review_badge",
        "publication_badge",
        "relevance_score",
        "valid_until",
        "created_at",
    )

    list_display_links = ("title",)

    list_filter = (
        "opportunity_level",
        "review_status",
        "is_published",
        "opportunity_type",
        "province",
        "industry",
        "created_at",
        "valid_until",
    )

    search_fields = (
        "title",
        "slug",
        "description",
        "target_market",
        "source",
        "rejection_reason",
        "company__name",
        "product__name_fa",
        "service_listing__title",
        "service_listing__seller__display_name",
        "industry__name_fa",
        "province__name_fa",
        "city__name_fa",
    )

    list_select_related = (
        "province",
        "city",
        "product",
        "service_listing",
        "industry",
        "company",
        "created_by",
        "last_reviewed_by",
    )

    ordering = ("-created_at",)
    date_hierarchy = "created_at"
    list_per_page = 30
    list_max_show_all = 100
    show_full_result_count = False
    save_on_top = True

    # --------------------------------------------------
    # Form configuration
    # --------------------------------------------------

    autocomplete_fields = (
        "province",
        "city",
        "product",
        "industry",
        "company",
        "created_by",
    )

    readonly_fields = (
        "review_status",
        "rejection_reason",
        "is_published",
        "published_at",
        "last_reviewed_at",
        "last_reviewed_by",
        "service_listing",
        "created_at",
        "updated_at",
    )

    fieldsets = (
        (
            "اطلاعات اصلی فرصت",
            {
                "fields": (
                    "title",
                    "slug",
                    "opportunity_type",
                    "opportunity_level",
                    "description",
                )
            },
        ),
        (
            "موقعیت جغرافیایی و ارتباطات",
            {
                "fields": (
                    ("province", "city"),
                    "product",
                    "service_listing",
                    "industry",
                    "company",
                )
            },
        ),
        (
            "بازار هدف و ظرفیت تجاری",
            {
                "fields": (
                    "target_market",
                    ("required_volume", "volume_unit"),
                    ("min_value", "max_value", "currency"),
                )
            },
        ),
        (
            "منبع و اعتبار فرصت",
            {
                "fields": (
                    "source",
                    "source_url",
                    "valid_until",
                )
            },
        ),
        (
            "ارزیابی و بررسی مدیریتی",
            {
                "classes": ("collapse",),
                "fields": (
                    "created_by",
                    "review_status",
                    "rejection_reason",
                    "relevance_score",
                ),
            },
        ),
        (
            "انتشار و سوابق مدیریتی",
            {
                "classes": ("collapse",),
                "fields": (
                    "is_published",
                    "published_at",
                    "last_reviewed_at",
                    "last_reviewed_by",
                    "created_at",
                    "updated_at",
                ),
            },
        ),
    )

    # --------------------------------------------------
    # Admin actions
    # --------------------------------------------------

    actions = (
        "approve_and_publish",
        "approve_without_publishing",
        "reject_and_unpublish",
        "request_changes",
        "unpublish_opportunities",
        "expire_opportunities",
    )

    # --------------------------------------------------
    # Query optimization
    # --------------------------------------------------

    def get_queryset(self, request):
        queryset = super().get_queryset(request)

        return queryset.select_related(
            "province",
            "city",
            "product",
            "service_listing",
            "industry",
            "company",
            "created_by",
            "last_reviewed_by",
        )

    # --------------------------------------------------
    # Visual status indicators
    # --------------------------------------------------

    @admin.display(description="سطح فرصت", ordering="opportunity_level")
    def level_badge(self, obj: TradeOpportunity):
        styles = {
            OpportunityLevel.NORMAL: (
                "فرصت عادی",
                "#64748b",
                "#f1f5f9",
            ),
            OpportunityLevel.IMPORTANT: (
                "فرصت مهم",
                "#2563eb",
                "#dbeafe",
            ),
            OpportunityLevel.HIGH_PROFIT: (
                "سودآوری بالا",
                "#15803d",
                "#dcfce7",
            ),
            OpportunityLevel.SPECIAL: (
                "فرصت ویژه",
                "#c2410c",
                "#ffedd5",
            ),
            OpportunityLevel.STRATEGIC: (
                "استراتژیک",
                "#7e22ce",
                "#f3e8ff",
            ),
        }

        label, color, background = styles.get(
            obj.opportunity_level,
            ("نامشخص", "#64748b", "#f1f5f9"),
        )

        return format_html(
            '<span style="background:{};color:{};'
            "padding:4px 10px;border-radius:6px;"
            'font-size:11px;font-weight:600;white-space:nowrap;">'
            "{}</span>",
            background,
            color,
            label,
        )

    @admin.display(description="وضعیت بررسی", ordering="review_status")
    def review_badge(self, obj: TradeOpportunity):
        states = {
            OpportunityReviewStatus.PENDING: "pending",
            OpportunityReviewStatus.APPROVED: "approved",
            OpportunityReviewStatus.REJECTED: "rejected",
        }
        return status_badge(
            obj.get_review_status_display(),
            states.get(obj.review_status, "neutral"),
        )

    @admin.display(description="وضعیت انتشار")
    def publication_badge(self, obj: TradeOpportunity):
        if obj.is_expired:
            label, state = "منقضی", "rejected"
        elif obj.is_published:
            label, state = "منتشرشده", "approved"
        else:
            label, state = "پیش‌نویس", "neutral"
        return status_badge(label, state)

    # --------------------------------------------------
    # Review tracking
    # --------------------------------------------------

    def save_model(self, request, obj, form, change):
        materially_changed = False
        if change:
            original = TradeOpportunity.objects.get(pk=obj.pk)
            content_fields = {
                "title",
                "province",
                "city",
                "product",
                "service_listing",
                "industry",
                "opportunity_type",
                "description",
                "target_market",
                "required_volume",
                "volume_unit",
                "min_value",
                "max_value",
                "currency",
                "company",
                "source",
                "source_url",
                "valid_until",
            }
            materially_changed = (
                original.review_status == OpportunityReviewStatus.APPROVED
                and bool(content_fields.intersection(form.changed_data))
            )
        if materially_changed:
            obj.review_status = OpportunityReviewStatus.PENDING
            obj.is_published = False
            obj.published_at = None
            obj.rejection_reason = ""
        super().save_model(request, obj, form, change)
        if materially_changed:
            audit(request.user, "trade.content_revised", obj)

    # --------------------------------------------------
    # Approve and publish
    # --------------------------------------------------

    @admin.action(description="✓ تأیید و انتشار فرصت‌های انتخاب‌شده", permissions=["moderate"])
    def approve_and_publish(self, request, queryset):
        published = expired = 0

        with transaction.atomic():
            for opportunity in queryset:
                opportunity.review_status = OpportunityReviewStatus.APPROVED
                opportunity.is_published = not opportunity.is_expired
                opportunity.published_at = timezone.now() if opportunity.is_published else None
                opportunity.rejection_reason = ""
                opportunity.last_reviewed_at = timezone.now()
                opportunity.last_reviewed_by = request.user

                opportunity.save()
                audit(
                    request.user,
                    "trade.approved",
                    opportunity,
                    published=opportunity.is_published,
                )

                published += int(opportunity.is_published)
                expired += int(opportunity.is_expired)

        self.message_user(
            request,
            f"{published} فرصت منتشر شد؛ {expired} فرصت منقضی تأیید شد اما منتشر نشد.",
            messages.SUCCESS,
        )

    # --------------------------------------------------
    # Approve without publishing
    # --------------------------------------------------

    @admin.action(description="✓ تأیید بدون انتشار", permissions=["moderate"])
    def approve_without_publishing(self, request, queryset):
        updated = 0

        with transaction.atomic():
            for opportunity in queryset:
                opportunity.review_status = OpportunityReviewStatus.APPROVED
                opportunity.is_published = False
                opportunity.published_at = None
                opportunity.rejection_reason = ""
                opportunity.last_reviewed_at = timezone.now()
                opportunity.last_reviewed_by = request.user

                opportunity.save()
                audit(request.user, "trade.approved_unpublished", opportunity)
                updated += 1

        self.message_user(
            request,
            f"{updated} فرصت تأیید شد و منتشر نشد.",
            messages.SUCCESS,
        )

    # --------------------------------------------------
    # Reject opportunities
    # --------------------------------------------------

    @admin.action(description="✕ رد و لغو انتشار", permissions=["moderate"])
    def reject_and_unpublish(self, request, queryset):
        reason = request.POST.get("rejection_reason", "").strip()
        if not reason:
            self.message_user(request, "برای رد فرصت، دلیل رد را وارد کنید.", messages.ERROR)
            return
        updated = 0

        with transaction.atomic():
            for opportunity in queryset:
                opportunity.review_status = OpportunityReviewStatus.REJECTED
                opportunity.is_published = False
                opportunity.published_at = None
                opportunity.rejection_reason = reason
                opportunity.last_reviewed_at = timezone.now()
                opportunity.last_reviewed_by = request.user

                opportunity.save()
                audit(request.user, "trade.rejected", opportunity, reason=reason)
                updated += 1

        self.message_user(
            request,
            f"{updated} فرصت رد و از انتشار خارج شد.",
            messages.WARNING,
        )

    # --------------------------------------------------
    # Unpublish opportunities
    # --------------------------------------------------

    @admin.action(description="درخواست اصلاح از ثبت‌کننده", permissions=["moderate"])
    def request_changes(self, request, queryset):
        reason = request.POST.get("rejection_reason", "").strip()
        if not reason:
            self.message_user(request, "برای درخواست اصلاح، دلیل را وارد کنید.", messages.ERROR)
            return
        updated = 0
        with transaction.atomic():
            for opportunity in queryset:
                opportunity.review_status = OpportunityReviewStatus.PENDING
                opportunity.is_published = False
                opportunity.published_at = None
                opportunity.rejection_reason = reason
                opportunity.last_reviewed_at = timezone.now()
                opportunity.last_reviewed_by = request.user
                opportunity.save()
                audit(request.user, "trade.changes_requested", opportunity, reason=reason)
                updated += 1
        self.message_user(request, f"برای {updated} فرصت درخواست اصلاح ثبت شد.", messages.SUCCESS)

    @admin.action(
        description="مخفی‌کردن فرصت‌ها از سایت",
        permissions=["moderate"],
    )
    def unpublish_opportunities(self, request, queryset):
        updated = 0

        with transaction.atomic():
            for opportunity in queryset:
                opportunity.is_published = False
                opportunity.published_at = None
                opportunity.save(update_fields=["is_published", "published_at", "updated_at"])
                audit(request.user, "trade.unpublished", opportunity)
                updated += 1

        self.message_user(
            request,
            f"{updated} فرصت از سایت مخفی شد.",
            messages.SUCCESS,
        )

    # --------------------------------------------------
    # Expire opportunities
    # --------------------------------------------------

    @admin.action(description="پایان اعتبار فرصت‌های انتخاب‌شده", permissions=["moderate"])
    def expire_opportunities(self, request, queryset):
        yesterday = timezone.localdate() - timedelta(days=1)
        updated = 0

        with transaction.atomic():
            for opportunity in queryset:
                opportunity.valid_until = yesterday
                opportunity.is_published = False
                opportunity.published_at = None
                opportunity.last_reviewed_at = timezone.now()
                opportunity.last_reviewed_by = request.user

                opportunity.save()
                audit(request.user, "trade.expired", opportunity)
                updated += 1

        self.message_user(
            request,
            f"اعتبار {updated} فرصت پایان یافت و از انتشار خارج شد.",
            messages.WARNING,
        )

    # --------------------------------------------------
    # Admin permissions
    # --------------------------------------------------

    def has_delete_permission(self, request, obj=None):
        return super().has_delete_permission(request, obj)
