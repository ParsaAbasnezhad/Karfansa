"""Security records for the independent Karfansa Control Center.

These models extend Django's existing user and permission system. They never
store a plaintext TOTP secret, recovery code, or management session cookie.
"""

from django.conf import settings
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


class AdminProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="management_profile"
    )
    suspended = models.BooleanField(default=False)
    mfa_seed = models.CharField(max_length=64, blank=True)
    enrollment_code_hash = models.CharField(max_length=255, blank=True)
    mfa_confirmed = models.BooleanField(default=False)
    recovery_code_hashes = models.JSONField(default=list)
    last_totp_step = models.BigIntegerField(default=-1)
    session_epoch = models.PositiveIntegerField(default=0)
    individual_actions = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"Management profile for {self.user_id}"


class AdminRole(models.Model):
    name = models.CharField(max_length=120, unique=True)
    description = models.CharField(max_length=300, blank=True)
    action_codes = models.JSONField(default=list)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return self.name


class AdminRoleAssignment(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="management_roles"
    )
    role = models.ForeignKey(AdminRole, on_delete=models.CASCADE, related_name="assignments")
    assigned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "role"], name="unique_management_role")]


class AdminObjectGrant(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="management_object_grants"
    )
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.CharField(max_length=100)
    actions = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "content_type", "object_id"],
                name="unique_management_object_grant",
            )
        ]
        indexes = [models.Index(fields=["content_type", "object_id"])]


class AdminSession(models.Model):
    """A revocable index of DB-backed management sessions; only a key hash is stored."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="management_sessions"
    )
    key_digest = models.CharField(max_length=64, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_seen_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=300, blank=True)

    class Meta:
        indexes = [models.Index(fields=["user", "revoked_at", "expires_at"])]


class AdminAuditEvent(models.Model):
    """Append-only operational trail. Ordinary management APIs have no edit/delete route."""

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="management_audit_events"
    )
    action = models.CharField(max_length=100)
    target_app = models.CharField(max_length=100, blank=True)
    target_model = models.CharField(max_length=100, blank=True)
    target_id = models.CharField(max_length=100, blank=True)
    result = models.CharField(max_length=24)
    request_id = models.CharField(max_length=64, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=300, blank=True)
    safe_changes = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=["actor", "created_at"]),
            models.Index(fields=["target_app", "target_model", "target_id", "created_at"]),
        ]
        ordering = ["-created_at", "-id"]

    def save(self, *args: object, **kwargs: object) -> None:
        if self.pk is not None:
            raise ValidationError("Administrative audit events are immutable.")
        super().save(*args, **kwargs)

    def delete(self, *args: object, **kwargs: object) -> None:
        raise ValidationError("Administrative audit events cannot be deleted.")
