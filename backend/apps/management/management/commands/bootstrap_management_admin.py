"""Enroll an existing Super Administrator for password-only Control Center access."""

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.management.models import AdminAuditEvent, AdminProfile
from apps.management.role_templates import ensure_default_role_templates
from apps.management.signals import revoke_management_sessions


class Command(BaseCommand):
    help = (
        "Provision an existing active Super Administrator for password-only "
        "Control Center authentication and seed default role templates."
    )

    def add_arguments(self, parser):  # type: ignore[no-untyped-def]
        parser.add_argument("--email", required=True)

    def handle(self, *args, **options):  # type: ignore[no-untyped-def]
        user = get_user_model().objects.filter(email__iexact=options["email"].strip()).first()
        if user is None or not user.is_active or not user.is_staff or not user.is_superuser:
            raise CommandError("An active existing Super Administrator is required.")
        with transaction.atomic():
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
                actor=None, action="auth.cli_bootstrap_password_only",
                target_app="accounts", target_model="user", target_id=str(user.pk),
                result="success", safe_changes={"changed_fields": ["management_profile"]},
            )
        created_roles = ensure_default_role_templates()
        self.stdout.write(self.style.SUCCESS(
            "Management profile provisioned for password-only Control Center login. "
            "Existing password was not changed."
        ))
        if created_roles:
            self.stdout.write(self.style.SUCCESS(
                "Seeded role templates: " + ", ".join(role.name for role in created_roles)
            ))
