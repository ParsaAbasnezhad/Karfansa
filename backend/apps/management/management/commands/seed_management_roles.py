"""Seed configurable default Control Center role templates."""

from django.core.management.base import BaseCommand

from apps.management.role_templates import ensure_default_role_templates


class Command(BaseCommand):
    help = "Create missing default management role templates without overwriting edits."

    def handle(self, *args, **options):  # type: ignore[no-untyped-def]
        created = ensure_default_role_templates()
        if created:
            names = ", ".join(role.name for role in created)
            self.stdout.write(self.style.SUCCESS(f"Created role templates: {names}"))
        else:
            self.stdout.write("Default role templates already present.")
