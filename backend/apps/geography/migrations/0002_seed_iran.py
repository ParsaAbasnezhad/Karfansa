from django.db import migrations

from apps.geography.seed_data import PROVINCES


def seed(apps, schema_editor):  # type: ignore[no-untyped-def]
    country_model = apps.get_model("geography", "Country")
    province_model = apps.get_model("geography", "Province")
    iran, _ = country_model.objects.get_or_create(
        iso2="IR", defaults={"name_fa": "ایران", "name_en": "Iran"}
    )
    for name_fa, name_en, slug in PROVINCES:
        province_model.objects.get_or_create(
            slug=slug, defaults={"country": iran, "name_fa": name_fa, "name_en": name_en}
        )


class Migration(migrations.Migration):
    dependencies = [("geography", "0001_initial")]

    # Reverse is a no-op on purpose: other tables may reference these rows by then.
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
