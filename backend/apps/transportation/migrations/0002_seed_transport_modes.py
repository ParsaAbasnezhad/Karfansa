from django.db import migrations

MODES = [
    ("road", "زمینی", "Road"),
    ("rail", "ریلی", "Rail"),
    ("sea", "دریایی", "Sea"),
    ("air", "هوایی", "Air"),
    ("multimodal", "ترکیبی", "Multimodal"),
]


def seed(apps, schema_editor):  # type: ignore[no-untyped-def]
    mode_model = apps.get_model("transportation", "TransportMode")
    for order, (code, name_fa, name_en) in enumerate(MODES, start=1):
        mode_model.objects.get_or_create(
            code=code, defaults={"name_fa": name_fa, "name_en": name_en, "sort_order": order}
        )


class Migration(migrations.Migration):
    dependencies = [("transportation", "0001_initial")]

    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
