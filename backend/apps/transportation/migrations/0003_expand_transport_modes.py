from django.db import migrations

RENAMES = {
    "road": ("حمل‌ونقل جاده‌ای", "Road", 1),
    "sea": ("حمل‌ونقل دریایی", "Sea", 2),
    "air": ("حمل‌ونقل هوایی", "Air", 3),
    "rail": ("حمل‌ونقل ریلی", "Rail", 4),
    "multimodal": ("حمل‌ونقل ترکیبی", "Multimodal", 5),
}

NEW_MODES = [
    ("warehouse", "انبارداری و لجستیک", "Warehousing", 6),
    ("international", "حمل‌ونقل بین‌المللی", "International", 7),
    ("customs", "ترخیص کالا و خدمات گمرکی", "Customs", 8),
    ("urban", "حمل‌ونقل شهری و توزیع", "Urban distribution", 9),
]


def seed(apps, schema_editor):  # type: ignore[no-untyped-def]
    mode_model = apps.get_model("transportation", "TransportMode")
    for code, (name_fa, name_en, order) in RENAMES.items():
        mode_model.objects.filter(code=code).update(
            name_fa=name_fa, name_en=name_en, sort_order=order
        )
    for code, name_fa, name_en, order in NEW_MODES:
        mode_model.objects.get_or_create(
            code=code,
            defaults={"name_fa": name_fa, "name_en": name_en, "sort_order": order},
        )


def unseed(apps, schema_editor):  # type: ignore[no-untyped-def]
    mode_model = apps.get_model("transportation", "TransportMode")
    mode_model.objects.filter(code__in=[code for code, *_ in NEW_MODES]).delete()
    originals = {
        "road": ("زمینی", 1),
        "rail": ("ریلی", 2),
        "sea": ("دریایی", 3),
        "air": ("هوایی", 4),
        "multimodal": ("ترکیبی", 5),
    }
    for code, (name_fa, order) in originals.items():
        mode_model.objects.filter(code=code).update(name_fa=name_fa, sort_order=order)


class Migration(migrations.Migration):
    dependencies = [("transportation", "0002_seed_transport_modes")]

    operations = [migrations.RunPython(seed, unseed)]
