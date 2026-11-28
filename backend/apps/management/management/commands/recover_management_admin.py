"""Emergency local recovery requiring trusted shell and database access.

Password-only Control Center authentication. Does not provision TOTP secrets.
"""

from getpass import getpass

from django.contrib.auth import get_user_model, password_validation
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.management.models import AdminAuditEvent, AdminProfile
from apps.management.role_templates import ensure_default_role_templates
from apps.management.signals import revoke_management_sessions


class Command(BaseCommand):
    help = "Recover or create a Super Administrator from a trusted local shell (password-only)."

    def add_arguments(self, parser):  # type: ignore[no-untyped-def]
        parser.add_argument("--email", required=True)
        parser.add_argument("--phone", help="Required only when creating a new user")

    def handle(self, *args, **options):  # type: ignore[no-untyped-def]
        email = options["email"].strip().lower()
        if input("Type RECOVER to confirm trusted emergency access: ").strip() != "RECOVER":
            raise CommandError("Recovery cancelled.")
        User = get_user_model()
        user = User.objects.filter(email__iexact=email).first()
        phone = (options.get("phone") or "").strip()
        if user is None and not phone:
            raise CommandError("--phone is required for a new administrator.")
        password = getpass("New administrator password: ")
        if password != getpass("Repeat new administrator password: "):
            raise CommandError("Passwords did not match.")
        password_validation.validate_password(password, user=user)
        with transaction.atomic():
            if user is None:
                user = User.objects.create_user(email=email, phone=phone, password=password)
            else:
                user.set_password(password)
            user.is_active = True
            user.is_staff = True
            user.is_superuser = True
            user.save()
            profile, _created = AdminProfile.objects.select_for_update().get_or_create(user=user)
            profile.mfa_seed = ""
            profile.enrollment_code_hash = ""
            profile.mfa_confirmed = False
            profile.recovery_code_hashes = []
            profile.last_totp_step = -1
            profile.suspended = False
            profile.save(update_fields=[
                "mfa_seed", "enrollment_code_hash", "mfa_confirmed",
                "recovery_code_hashes", "last_totp_step", "suspended", "updated_at",
            ])
            revoke_management_sessions(user.pk)
            AdminAuditEvent.objects.create(
                actor=None, action="auth.emergency_recovery",
                target_app="accounts", target_model="user", target_id=str(user.pk),
                result="success",
                safe_changes={"changed_fields": ["password", "management_profile"]},
            )
        ensure_default_role_templates()
        self.stdout.write(self.style.SUCCESS(
            "Emergency administrator recovery complete (password-only)."
        ))
