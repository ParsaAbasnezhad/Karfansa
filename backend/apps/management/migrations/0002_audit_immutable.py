"""Enforce append-only management audit history at the PostgreSQL boundary."""

from django.db import migrations


def install_trigger(apps, schema_editor):  # type: ignore[no-untyped-def]
    if schema_editor.connection.vendor != "postgresql":
        return
    table = apps.get_model("management", "AdminAuditEvent")._meta.db_table
    quoted = schema_editor.quote_name(table)
    with schema_editor.connection.cursor() as cursor:
        cursor.execute("""
            CREATE FUNCTION karfansa_reject_management_audit_change()
            RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN
                IF TG_OP = 'DELETE' AND current_user = 'karfansa_audit_archiver' THEN
                    RETURN OLD;
                END IF;
                RAISE EXCEPTION 'Management audit events are append-only'
                    USING ERRCODE = 'integrity_constraint_violation';
            END;
            $$;
        """)
        cursor.execute(f"""
            CREATE TRIGGER management_audit_append_only
            BEFORE UPDATE OR DELETE ON {quoted}
            FOR EACH ROW EXECUTE FUNCTION karfansa_reject_management_audit_change();
        """)


def remove_trigger(apps, schema_editor):  # type: ignore[no-untyped-def]
    if schema_editor.connection.vendor != "postgresql":
        return
    table = apps.get_model("management", "AdminAuditEvent")._meta.db_table
    quoted = schema_editor.quote_name(table)
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(f"DROP TRIGGER IF EXISTS management_audit_append_only ON {quoted};")
        cursor.execute("DROP FUNCTION IF EXISTS karfansa_reject_management_audit_change();")


class Migration(migrations.Migration):
    dependencies = [("management", "0001_initial")]
    operations = [migrations.RunPython(install_trigger, remove_trigger)]
