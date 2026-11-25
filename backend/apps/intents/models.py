import uuid

# Persian labels are intentional.
# ruff: noqa: RUF001
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class IntentGoal(models.TextChoices):
    COMPANY_OWNER = "company_owner", "صاحب شرکت هستم"
    OFFERING = "offering", "محصول یا خدمات دارم"
    HAVE_OPPORTUNITY = "have_opportunity", "فرصت تجاری دارم"
    SEEK_OPPORTUNITY = "seek_opportunity", "دنبال فرصت تجاری هستم"
    EXPLORING = "exploring", "برای آشنایی و بررسی آمده‌ام"


class FollowUpStatus(models.TextChoices):
    NEW = "new", "جدید"
    REVIEWING = "reviewing", "در حال بررسی"
    CONTACTED = "contacted", "تماس گرفته‌شده"
    COMPLETED = "completed", "پیگیری تکمیل‌شده"
    NOT_NEEDED = "not_needed", "بدون نیاز به پیگیری"


class UserIntent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="intent_record",
        verbose_name="حساب کاربری",
    )
    # Only an HMAC digest is stored; the browser holds the random bearer token.
    guest_token_hash = models.CharField(
        "شناسه مهمان", max_length=64, unique=True, null=True, blank=True, editable=False
    )
    merged_into = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="merged_intent_records",
        verbose_name="ادغام‌شده در حساب",
    )
    goals = models.JSONField("اهداف انتخاب‌شده", default=list, blank=True)
    contact_phone = models.CharField("شماره تماس اختیاری", max_length=11, blank=True)
    contact_consent = models.BooleanField("رضایت تماس پیگیری", default=False)
    consent_at = models.DateTimeField("زمان ثبت رضایت", null=True, blank=True)
    consent_text_version = models.CharField("نسخه متن رضایت", max_length=32, blank=True)
    follow_up_status = models.CharField(
        "وضعیت پیگیری", max_length=16, choices=FollowUpStatus.choices, default=FollowUpStatus.NEW
    )
    admin_note = models.TextField("یادداشت داخلی مدیریت", blank=True)
    created_at = models.DateTimeField("تاریخ ثبت", auto_now_add=True)
    updated_at = models.DateTimeField("آخرین بروزرسانی", auto_now=True)

    class Meta:
        verbose_name = "هدف کاربر و سرنخ تجاری"
        verbose_name_plural = "اهداف کاربران و سرنخ‌های تجاری"
        ordering = ("-created_at",)
        permissions = (("view_lead_contact", "می‌تواند اطلاعات تماس سرنخ‌ها را ببیند"),)
        indexes = (
            models.Index(
                fields=("follow_up_status", "created_at"), name="intent_followup_date_idx"
            ),
            models.Index(fields=("merged_into",), name="intent_merged_user_idx"),
        )

    def __str__(self) -> str:
        return str(self.id)

    def clean(self) -> None:
        super().clean()
        allowed = {key for key, _label in IntentGoal.choices}
        if (
            not isinstance(self.goals, list)
            or (not self.goals and self.user_id is None)
            or len(self.goals) > len(allowed)
            or len(self.goals) != len(set(self.goals))
            or any(goal not in allowed for goal in self.goals)
            or (IntentGoal.EXPLORING in self.goals and len(self.goals) > 1)
        ):
            raise ValidationError({"goals": "اهداف انتخاب‌شده معتبر نیستند."})
        if self.contact_consent and not self.contact_phone and not self.merged_into_id:
            raise ValidationError({"contact_consent": "برای درخواست تماس، شماره موبایل لازم است."})
        if self.user_id and self.merged_into_id:
            raise ValidationError("رکورد نمی‌تواند هم فعال و هم ادغام‌شده باشد.")
