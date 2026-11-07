import json
from pathlib import Path

from django.db import migrations


def seed_iran_cities(apps, schema_editor):
    Province = apps.get_model("geography", "Province")
    City = apps.get_model("geography", "City")
    dataset_path = Path(__file__).resolve().parent.parent / "data" / "iran_cities.json"
    records = json.loads(dataset_path.read_text(encoding="utf-8"))
    provinces = {
        province.name_fa: province
        for province in Province.objects.filter(country__iso2="IR")
    }

    cities = []
    for record in records:
        province = provinces.get(record["province"])
        if province is None:
            raise RuntimeError(f"Unknown Iranian province in city dataset: {record['province']}")
        cities.extend(
            City(province_id=province.pk, name_fa=name)
            for name in record["cities"]
        )

    City.objects.bulk_create(cities, ignore_conflicts=True, batch_size=500)


class Migration(migrations.Migration):
    dependencies = [
        ("geography", "0002_seed_iran"),
    ]

    operations = [
        migrations.RunPython(seed_iran_cities, migrations.RunPython.noop),
    ]
