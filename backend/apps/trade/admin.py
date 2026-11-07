from datetime import timedelta

from django.contrib import admin, messages
from django.utils import timezone

from .models import OpportunityReviewStatus, TradeOpportunity


@admin.register(TradeOpportunity)
class TradeOpportunityAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    list_display = (
        "title",
        "opportunity_type",
        "province",
        "product",
        "industry",
        "review_status",
        "publication_state",
        "relevance_score",
        "valid_until",
    )
    list_filter = (
        "review_status",
        "is_published",
        "opportunity_type",
        "province",
        "product",
        "industry",
    )
    search_fields = (
        "title",
        "slug",
        "description",
        "target_market",
        "source",
        "company__name",
        "product__name_fa",
        "industry__name_fa",
        "province__name_fa",
        "city__name_fa",
    )
    autocomplete_fields = (
        "province",
        "city",
        "product",
        "industry",
        "company",
        "created_by",
    )
    list_select_related = ("province", "city", "product", "industry", "company")
    date_hierarchy = "created_at"
    ordering = ("-created_at",)
    readonly_fields = (
        "published_at",
        "last_reviewed_at",
        "last_reviewed_by",
        "created_at",
        "updated_at",
    )
    actions = ("approve_and_publish", "reject_and_unpublish", "expire_opportunities")
    fieldsets = (
        ("اطلاعات فرصت", {"fields": ("title", "slug", "opportunity_type", "description")}),
        ("موقعیت و ارتباطات", {"fields": ("province", "city", "product", "industry", "company")}),
        (
            "بازار و ظرفیت",
            {
                "fields": (
                    "target_market",
                    "required_volume",
                    "volume_unit",
                    ("min_value", "max_value", "currency"),
                )
            },
        ),
        ("منبع و اعتبار", {"fields": ("source", "source_url", "valid_until")}),
        ("ثبت و بررسی", {"fields": ("created_by", "review_status", "relevance_score")}),
        (
            "انتشار و سوابق",
            {
                "fields": (
                    "is_published",
                    "published_at",
                    "last_reviewed_at",
                    "last_reviewed_by",
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )

    @admin.display(description="وضعیت انتشار")
    def publication_state(self, opportunity: TradeOpportunity) -> str:
        if opportunity.is_expired:
            return "منقضی"
        return "منتشرشده" if opportunity.is_published else "پیش‌نویس"

    def save_model(self, request, obj, form, change) -> None:  # type: ignore[no-untyped-def]
        obj.last_reviewed_at = timezone.now()
        obj.last_reviewed_by = request.user
        super().save_model(request, obj, form, change)

    @admin.action(description="تأیید و انتشار فرصت‌های انتخاب‌شده")
    def approve_and_publish(self, request, queryset) -> None:  # type: ignore[no-untyped-def]
        published = expired = 0
        for opportunity in queryset:
            opportunity.review_status = OpportunityReviewStatus.APPROVED
            opportunity.is_published = not opportunity.is_expired
            opportunity.last_reviewed_at = timezone.now()
            opportunity.last_reviewed_by = request.user
            opportunity.save()
            published += int(opportunity.is_published)
            expired += int(opportunity.is_expired)
        self.message_user(
            request,
            f"{published} فرصت منتشر شد؛ {expired} فرصت منقضی تأیید شد اما منتشر نشد.",
            messages.SUCCESS,
        )

    @admin.action(description="رد و لغو انتشار فرصت‌های انتخاب‌شده")
    def reject_and_unpublish(self, request, queryset) -> None:  # type: ignore[no-untyped-def]
        for opportunity in queryset:
            opportunity.review_status = OpportunityReviewStatus.REJECTED
            opportunity.is_published = False
            opportunity.last_reviewed_at = timezone.now()
            opportunity.last_reviewed_by = request.user
            opportunity.save()
        self.message_user(request, "فرصت‌های انتخاب‌شده رد و از انتشار خارج شدند.", messages.SUCCESS)

    @admin.action(description="منقضی‌کردن فرصت‌های انتخاب‌شده")
    def expire_opportunities(self, request, queryset) -> None:  # type: ignore[no-untyped-def]
        yesterday = timezone.localdate() - timedelta(days=1)
        for opportunity in queryset:
            opportunity.valid_until = yesterday
            opportunity.is_published = False
            opportunity.last_reviewed_at = timezone.now()
            opportunity.last_reviewed_by = request.user
            opportunity.save()
        self.message_user(request, "اعتبار فرصت‌های انتخاب‌شده پایان یافت.", messages.SUCCESS)
