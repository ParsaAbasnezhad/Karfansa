from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models

from apps.core.storage import PrivateFileSystemStorage
from apps.core.uploads import UploadTo


class DocumentType(models.TextChoices):
    NATIONAL_ID = "national_id", "شناسه ملی"
    REGISTRATION = "registration", "آگهی ثبت"
    TAX = "tax", "مدرک مالیاتی"
    REPRESENTATIVE = "representative", "معرفی‌نامه نماینده"
    IDENTITY = "identity", "مدرک هویتی"
    OTHER = "other", "سایر"


class DocumentReviewStatus(models.TextChoices):
    PENDING = "pending", "در انتظار بررسی"
    APPROVED = "approved", "تأییدشده"
    REJECTED = "rejected", "ردشده"


class VerificationDocument(models.Model):
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.CharField(max_length=36)
    content_object = GenericForeignKey("content_type", "object_id")
    document_type = models.CharField(max_length=24, choices=DocumentType.choices)
    file = models.FileField(
        upload_to=UploadTo("verification"),
        storage=PrivateFileSystemStorage(),
        verbose_name="پرونده",
    )
    review_status = models.CharField(
        max_length=12,
        choices=DocumentReviewStatus.choices,
        default=DocumentReviewStatus.PENDING,
    )
    rejection_reason = models.CharField(max_length=500, blank=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="uploaded_verification_documents",
    )
    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="reviewed_verification_documents",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "مدرک تأیید"
        verbose_name_plural = "مدارک تأیید"
        indexes = [
            models.Index(fields=["content_type", "object_id"], name="verify_doc_owner_idx"),
            models.Index(fields=["review_status"], name="verify_doc_status_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.get_document_type_display()} · {self.object_id}"


class BusinessAuditLog(models.Model):
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="business_audit_events",
    )
    action = models.CharField(max_length=64)
    target_type = models.CharField(max_length=80)
    target_id = models.CharField(max_length=36)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "رویداد حساب کسب‌وکار"
        verbose_name_plural = "رویدادهای حساب کسب‌وکار"
        indexes = [
            models.Index(fields=["target_type", "target_id"], name="biz_audit_target_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.action} · {self.target_type}:{self.target_id}"
