from django.db import models


class VerificationStatus(models.TextChoices):
    DRAFT = "draft", "پیش‌نویس"
    PENDING = "pending_review", "در انتظار بررسی"
    VERIFIED = "verified", "تأییدشده"
    REJECTED = "rejected", "ردشده"
    SUSPENDED = "suspended", "تعلیق‌شده"


USER_SUBMIT_STATES = {VerificationStatus.DRAFT, VerificationStatus.REJECTED}
STAFF_DECISIONS = {
    VerificationStatus.VERIFIED,
    VerificationStatus.REJECTED,
    VerificationStatus.SUSPENDED,
}
