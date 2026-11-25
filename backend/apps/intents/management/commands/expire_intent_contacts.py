"""Anonymize old guest contact details while preserving aggregate intent counts."""

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from apps.intents.models import UserIntent


class Command(BaseCommand):
    help = "Anonymize expired guest lead contacts; dry-run unless --apply is given."

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true", help="Apply the anonymization.")

    def handle(self, *args, **options):
        now = timezone.now()
        without_consent = now - timedelta(days=180)
        with_consent = now - timedelta(days=365)
        eligible = (
            UserIntent.objects.filter(user__isnull=True, merged_into__isnull=True)
            .filter(
                Q(contact_consent=False, created_at__lt=without_consent)
                | Q(contact_consent=True, created_at__lt=with_consent)
            )
            .filter(Q(guest_token_hash__isnull=False) | ~Q(contact_phone="") | ~Q(admin_note=""))
        )
        count = eligible.count()
        if not options["apply"]:
            self.stdout.write(f"Dry run: {count} guest intent records would be anonymized.")
            return
        with transaction.atomic():
            updated = eligible.update(
                guest_token_hash=None,
                contact_phone="",
                contact_consent=False,
                admin_note="",
                updated_at=now,
            )
        self.stdout.write(self.style.SUCCESS(f"Anonymized {updated} guest intent records."))
