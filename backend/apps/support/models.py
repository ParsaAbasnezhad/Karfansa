from django.conf import settings
from django.db import models

from apps.core.models import UUIDTimeStampedModel
from apps.core.uploads import UploadTo

from .validators import validate_attachment, validate_attachment_extension


class TicketCategory(models.TextChoices):
    TECHNICAL = "technical", "پشتیبانی فنی"
    BUSINESS = "business", "همکاری تجاری"
    COMPANY = "company", "ثبت شرکت"
    ADS = "ads", "تبلیغات"
    FEEDBACK = "feedback", "پیشنهاد و انتقاد"
    OTHER = "other", "سایر موارد"


class TicketPriority(models.TextChoices):
    LOW = "low", "کم"
    NORMAL = "normal", "معمولی"
    HIGH = "high", "بالا"
    URGENT = "urgent", "فوری"


class TicketStatus(models.TextChoices):
    OPEN = "open", "باز"
    IN_PROGRESS = "in_progress", "در حال بررسی"
    WAITING_FOR_USER = "waiting_for_user", "در انتظار پاسخ کاربر"
    ANSWERED = "answered", "پاسخ داده‌شده"
    CLOSED = "closed", "بسته‌شده"


class TicketSource(models.TextChoices):
    PROFILE = "profile", "پنل کاربری"
    CONTACT = "contact", "فرم تماس"
    GUEST = "guest", "مهمان"


class SenderType(models.TextChoices):
    USER = "user", "کاربر"
    STAFF = "staff", "پشتیبانی"
    SYSTEM = "system", "سیستم"


CONTACT_SUBJECT_TO_CATEGORY = {
    "پشتیبانی فنی": TicketCategory.TECHNICAL,
    "همکاری تجاری": TicketCategory.BUSINESS,
    "ثبت شرکت": TicketCategory.COMPANY,
    "تبلیغات": TicketCategory.ADS,
    "پیشنهاد و انتقاد": TicketCategory.FEEDBACK,
    "سایر موارد": TicketCategory.OTHER,
}


class SupportTicket(UUIDTimeStampedModel):
    ticket_number = models.CharField(max_length=24, unique=True, verbose_name="شماره تیکت")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="support_tickets",
        verbose_name="کاربر",
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="assigned_support_tickets",
        verbose_name="کارشناس",
        limit_choices_to={"is_staff": True},
    )
    subject = models.CharField(max_length=180, verbose_name="موضوع")
    category = models.CharField(
        max_length=32,
        choices=TicketCategory.choices,
        default=TicketCategory.OTHER,
        verbose_name="دسته‌بندی",
    )
    priority = models.CharField(
        max_length=16,
        choices=TicketPriority.choices,
        default=TicketPriority.NORMAL,
        verbose_name="اولویت",
    )
    status = models.CharField(
        max_length=32,
        choices=TicketStatus.choices,
        default=TicketStatus.OPEN,
        db_index=True,
        verbose_name="وضعیت",
    )
    source = models.CharField(
        max_length=16,
        choices=TicketSource.choices,
        default=TicketSource.PROFILE,
        verbose_name="منبع",
    )
    contact_name = models.CharField(max_length=120, verbose_name="نام تماس")
    contact_email = models.EmailField(verbose_name="ایمیل تماس")
    contact_phone = models.CharField(max_length=24, blank=True, verbose_name="تلفن تماس")
    access_token_hash = models.CharField(max_length=64, blank=True, db_index=True)
    last_message_at = models.DateTimeField(null=True, blank=True, verbose_name="آخرین پیام")
    last_message_excerpt = models.CharField(max_length=180, blank=True, verbose_name="آخرین متن")
    user_last_read_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True, verbose_name="زمان بستن")

    class Meta:
        ordering = ["-last_message_at", "-created_at"]
        verbose_name = "تیکت پشتیبانی"
        verbose_name_plural = "تیکت‌های پشتیبانی"
        indexes = [
            models.Index(fields=["user", "status"]),
            models.Index(fields=["status", "priority"]),
            models.Index(fields=["contact_email"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.ticket_number} — {self.subject}"

    @property
    def is_closed(self) -> bool:
        return self.status == TicketStatus.CLOSED

    @property
    def awaiting_staff(self) -> bool:
        return self.status in {TicketStatus.OPEN, TicketStatus.IN_PROGRESS}

    @property
    def awaiting_user(self) -> bool:
        return self.status in {TicketStatus.WAITING_FOR_USER, TicketStatus.ANSWERED}


class TicketMessage(UUIDTimeStampedModel):
    ticket = models.ForeignKey(
        SupportTicket,
        on_delete=models.CASCADE,
        related_name="messages",
        verbose_name="تیکت",
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="support_messages",
        verbose_name="فرستنده",
    )
    sender_type = models.CharField(
        max_length=16,
        choices=SenderType.choices,
        default=SenderType.USER,
        verbose_name="نوع فرستنده",
    )
    message = models.TextField(max_length=5000, verbose_name="پیام")
    attachment = models.FileField(
        upload_to=UploadTo("support/attachments"),
        blank=True,
        validators=[validate_attachment_extension, validate_attachment],
        verbose_name="پیوست",
    )
    is_internal = models.BooleanField(default=False, verbose_name="یادداشت داخلی")

    class Meta:
        ordering = ["created_at"]
        verbose_name = "پیام تیکت"
        verbose_name_plural = "پیام‌های تیکت"
        indexes = [
            models.Index(fields=["ticket", "created_at"]),
            models.Index(fields=["ticket", "is_internal"]),
        ]

    def __str__(self) -> str:
        return f"{self.ticket.ticket_number} ({self.sender_type})"
