"""Safety net: drop retired Market tables if any remain after app removal.

Existing databases should apply `market.0005_remove_market_models` while that
app is still installed. This migration covers environments that already removed
the Market app from the codebase, and cleans orphaned migration / content-type
rows. Fresh installs never create Market tables.
"""

from django.db import migrations


MARKET_TABLES = (
    "market_marketprice",
    "market_marketindicator",
    "market_marketdataprovider",
    "market_marketquote",  # retired earlier in market history
)


def drop_market_tables(apps, schema_editor):  # type: ignore[no-untyped-def]
    if schema_editor.connection.vendor != "postgresql":
        return
    with schema_editor.connection.cursor() as cursor:
        for table in MARKET_TABLES:
            cursor.execute(f'DROP TABLE IF EXISTS "{table}" CASCADE')


def cleanup_market_metadata(apps, schema_editor):  # type: ignore[no-untyped-def]
    ContentType = apps.get_model("contenttypes", "ContentType")
    Permission = apps.get_model("auth", "Permission")
    cts = ContentType.objects.filter(app_label="market")
    Permission.objects.filter(content_type__in=cts).delete()
    cts.delete()
    with schema_editor.connection.cursor() as cursor:
        cursor.execute("DELETE FROM django_migrations WHERE app = %s", ["market"])


class Migration(migrations.Migration):
    dependencies = [
        ("management", "0002_audit_immutable"),
        ("contenttypes", "0002_remove_content_type_name"),
        ("auth", "0012_alter_user_first_name_max_length"),
    ]

    operations = [
        migrations.RunPython(drop_market_tables, migrations.RunPython.noop),
        migrations.RunPython(cleanup_market_metadata, migrations.RunPython.noop),
    ]
