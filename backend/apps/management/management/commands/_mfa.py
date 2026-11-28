"""Interactive, local-only MFA enrollment shared by recovery commands."""

import secrets

from django.core.management.base import CommandError

from apps.management.models import AdminAuditEvent, AdminProfile
from apps.management.signals import revoke_management_sessions
from apps.management.totp import (
    authenticator_secret, create_recovery_codes, matching_totp_step,
)


def enroll_from_terminal(user, *, action: str, stdout) -> None:  # type: ignore[no-untyped-def]
    profile, _ = AdminProfile.objects.get_or_create(user=user)
    profile.mfa_seed = secrets.token_hex(32)
    profile.enrollment_code_hash = ""
    profile.mfa_confirmed = False
    profile.last_totp_step = -1
    profile.recovery_code_hashes = []
    profile.save()
    stdout.write("Add this TOTP secret to an authenticator. It is shown only here:")
    stdout.write(authenticator_secret(profile))
    code = input("Enter the current six-digit authenticator code: ").strip()
    step = matching_totp_step(profile, code)
    if step is None:
        raise CommandError("Authenticator code did not match; rerun the command.")
    recovery_codes, hashes = create_recovery_codes()
    profile.last_totp_step = step
    profile.recovery_code_hashes = hashes
    profile.mfa_confirmed = True
    profile.save(update_fields=["last_totp_step", "recovery_code_hashes", "mfa_confirmed", "updated_at"])
    revoke_management_sessions(user.pk)
    AdminAuditEvent.objects.create(
        actor=None, action=action, target_app="accounts", target_model="user",
        target_id=str(user.pk), result="success",
        safe_changes={"changed_fields": ["management_mfa"]},
    )
    stdout.write("Store these one-time recovery codes in an approved secure vault:")
    for recovery_code in recovery_codes:
        stdout.write(recovery_code)
