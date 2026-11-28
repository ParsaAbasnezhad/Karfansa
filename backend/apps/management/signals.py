"""Invalidate management sessions when core authorization state changes."""

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.db.models import F
from django.db.models.signals import m2m_changed, post_delete, post_save, pre_save
from django.dispatch import receiver
from django.utils import timezone

from .models import AdminObjectGrant, AdminProfile, AdminRole, AdminRoleAssignment, AdminSession


def revoke_management_sessions(user_id: int) -> None:
    """Revoke every active console session after a security-sensitive change."""
    AdminProfile.objects.filter(user_id=user_id).update(session_epoch=F("session_epoch") + 1)
    AdminSession.objects.filter(user_id=user_id, revoked_at__isnull=True).update(revoked_at=timezone.now())


User = get_user_model()


@receiver(pre_save, sender=User)
def remember_user_security_state(sender, instance, **kwargs):  # type: ignore[no-untyped-def]
    if instance.pk:
        instance._management_previous_security = (
            sender.objects.filter(pk=instance.pk)
            .values_list("is_active", "is_staff", "is_superuser", "password")
            .first()
        )


@receiver(pre_save, sender=AdminProfile)
def remember_profile_security_state(sender, instance, **kwargs):  # type: ignore[no-untyped-def]
    if instance.pk:
        instance._management_previous_profile = (
            sender.objects.filter(pk=instance.pk)
            .values_list("suspended", "mfa_confirmed", "individual_actions")
            .first()
        )


@receiver(post_save, sender=AdminProfile)
def revoke_after_profile_security_change(sender, instance, created, **kwargs):  # type: ignore[no-untyped-def]
    old = getattr(instance, "_management_previous_profile", None)
    if not created and old is not None:
        current = (instance.suspended, instance.mfa_confirmed, instance.individual_actions)
        if current != old:
            revoke_management_sessions(instance.user_id)


@receiver(post_save, sender=User)
def revoke_after_user_security_change(sender, instance, created, **kwargs):  # type: ignore[no-untyped-def]
    old = getattr(instance, "_management_previous_security", None)
    if not created and old is not None:
        current = (instance.is_active, instance.is_staff, instance.is_superuser, instance.password)
        if current != old:
            revoke_management_sessions(instance.pk)


@receiver(m2m_changed, sender=User.groups.through)
@receiver(m2m_changed, sender=User.user_permissions.through)
def revoke_after_django_permission_change(sender, instance, action, reverse, pk_set, **kwargs):  # type: ignore[no-untyped-def]
    if action == "pre_clear" and reverse:
        instance._management_cleared_user_ids = list(instance.user_set.values_list("pk", flat=True))
        return
    if action not in {"post_add", "post_remove", "post_clear"}:
        return
    if reverse:
        affected = pk_set if pk_set is not None else getattr(instance, "_management_cleared_user_ids", [])
        for user_id in affected:
            revoke_management_sessions(user_id)
    else:
        revoke_management_sessions(instance.pk)


@receiver(m2m_changed, sender=Group.permissions.through)
def revoke_after_group_permission_change(sender, instance, action, reverse, pk_set, **kwargs):  # type: ignore[no-untyped-def]
    if action == "pre_clear" and reverse:
        instance._management_cleared_group_ids = list(instance.group_set.values_list("pk", flat=True))
        return
    if action not in {"post_add", "post_remove", "post_clear"}:
        return
    if reverse:
        group_ids = pk_set if pk_set is not None else getattr(instance, "_management_cleared_group_ids", [])
    else:
        group_ids = [instance.pk]
    for user_id in User.objects.filter(groups__pk__in=group_ids).values_list("pk", flat=True).distinct():
        revoke_management_sessions(user_id)


@receiver(post_save, sender=AdminRoleAssignment)
@receiver(post_delete, sender=AdminRoleAssignment)
@receiver(post_save, sender=AdminObjectGrant)
@receiver(post_delete, sender=AdminObjectGrant)
def revoke_after_management_grant_change(sender, instance, **kwargs):  # type: ignore[no-untyped-def]
    revoke_management_sessions(instance.user_id)


@receiver(post_save, sender=AdminRole)
def revoke_after_role_change(sender, instance, created, **kwargs):  # type: ignore[no-untyped-def]
    if not created:
        for user_id in instance.assignments.values_list("user_id", flat=True).iterator():
            revoke_management_sessions(user_id)
