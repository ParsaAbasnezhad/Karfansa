"""Stream old audit events to a hashed archive; optional privileged purge."""

import hashlib
import json
import os
from datetime import timedelta
from pathlib import Path

import psycopg
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.management.models import AdminAuditEvent


class Command(BaseCommand):
    help = "Archive old management audit events; purge only with a separate DB archiver role."

    def add_arguments(self, parser):  # type: ignore[no-untyped-def]
        parser.add_argument("--output", required=True, help="Private destination .jsonl path")
        parser.add_argument("--retention-days", type=int, default=730)
        parser.add_argument("--purge", action="store_true")

    def handle(self, *args, **options):  # type: ignore[no-untyped-def]
        days = options["retention_days"]
        if days < 365:
            raise CommandError("Retention must be at least 365 days.")
        output = Path(options["output"]).expanduser().resolve()
        for public_root in (settings.STATIC_ROOT, settings.MEDIA_ROOT):
            if output.is_relative_to(Path(public_root).resolve()):
                raise CommandError("Archive must not be stored in a public directory.")
        if not output.parent.is_dir() or output.exists() or output.with_suffix(output.suffix + ".sha256").exists():
            raise CommandError("A new archive path inside an existing private directory is required.")
        cutoff = timezone.now() - timedelta(days=days)
        queryset = AdminAuditEvent.objects.filter(created_at__lt=cutoff).order_by("id")
        digest = hashlib.sha256()
        count = 0
        id_digest = hashlib.sha256()
        try:
            with output.open("x", encoding="utf-8", newline="\n") as handle:
                for event in queryset.iterator(chunk_size=1000):
                    row = {
                        "id": event.pk, "actor_id": event.actor_id,
                        "action": event.action, "target_app": event.target_app,
                        "target_model": event.target_model, "target_id": event.target_id,
                        "result": event.result, "request_id": event.request_id,
                        "ip_address": event.ip_address, "user_agent": event.user_agent,
                        "safe_changes": event.safe_changes,
                        "created_at": event.created_at.isoformat(),
                    }
                    line = json.dumps(row, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n"
                    handle.write(line)
                    digest.update(line.encode("utf-8"))
                    id_digest.update(f"{event.pk}\n".encode())
                    count += 1
                handle.flush()
                os.fsync(handle.fileno())
            manifest = output.with_suffix(output.suffix + ".sha256")
            manifest.write_text(
                json.dumps({"sha256": digest.hexdigest(), "count": count, "id_sha256": id_digest.hexdigest(), "cutoff": cutoff.isoformat()}, sort_keys=True) + "\n",
                encoding="utf-8",
            )
        except Exception:
            output.unlink(missing_ok=True)
            raise
        self.stdout.write(f"Archived {count} audit events to {output}; SHA-256 {digest.hexdigest()}")
        if not options["purge"] or count == 0:
            return
        dsn = os.environ.get("MANAGEMENT_AUDIT_ARCHIVER_DSN", "")
        if not dsn:
            raise CommandError("MANAGEMENT_AUDIT_ARCHIVER_DSN is required to purge.")
        if input("Type PURGE VERIFIED ARCHIVE to continue: ").strip() != "PURGE VERIFIED ARCHIVE":
            raise CommandError("Purge cancelled; archive remains available.")
        # This role is granted DELETE only for retention operations by the DBA.
        # The trigger rejects ordinary application-role deletion.
        with psycopg.connect(dsn) as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT current_user, current_database()")
                role, database_name = cursor.fetchone()
                if role != "karfansa_audit_archiver":
                    raise CommandError("A dedicated audit archiver database role is required.")
                if database_name != settings.DATABASES["default"]["NAME"]:
                    raise CommandError("Archive DSN points to a different database.")
                cursor.execute(
                    "SELECT id FROM management_adminauditevent WHERE created_at < %s ORDER BY id FOR UPDATE",
                    (cutoff,),
                )
                selected = cursor.fetchall()
                candidate_digest = hashlib.sha256()
                for (event_id,) in selected:
                    candidate_digest.update(f"{event_id}\n".encode())
                if len(selected) != count or candidate_digest.hexdigest() != id_digest.hexdigest():
                    raise CommandError("Database set changed; purge cancelled.")
                cursor.execute(
                    "DELETE FROM management_adminauditevent WHERE created_at < %s",
                    (cutoff,),
                )
                if cursor.rowcount != count:
                    raise CommandError("Deleted count differed; purge cancelled.")
        self.stdout.write(self.style.SUCCESS(f"Purged {count} archived audit events."))
