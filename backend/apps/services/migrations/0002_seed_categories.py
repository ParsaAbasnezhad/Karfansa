from django.db import migrations


CATEGORIES = (
    ("agriculture", "کشاورزی", None),
    ("livestock", "دام و فرآورده‌های دامی", None),
    ("handicrafts", "صنایع‌دستی", None),
    ("other-goods", "سایر محصولات", None),
    ("grains", "غلات", "agriculture"),
    ("fruits", "میوه و محصولات باغی", "agriculture"),
    ("nuts", "خشکبار و مغزها", "agriculture"),
    ("spices", "ادویه و گیاهان دارویی", "agriculture"),
    ("dairy", "لبنیات", "livestock"),
    ("livestock-products", "گوشت و فرآورده‌های دامی", "livestock"),
    ("wool-leather", "پشم و چرم", "livestock"),
    ("carpets-rugs", "فرش و گلیم", "handicrafts"),
    ("pottery", "سفال و سرامیک", "handicrafts"),
    ("handmade-goods", "دست‌سازه‌ها", "handicrafts"),
)


def seed_categories(apps, schema_editor):
    category_model = apps.get_model("services", "ServiceCategory")
    categories = {}
    for slug, name, parent_slug in CATEGORIES:
        parent = categories.get(parent_slug)
        category, _ = category_model.objects.using(schema_editor.connection.alias).get_or_create(
            slug=slug,
            defaults={"name": name, "parent": parent},
        )
        categories[slug] = category


class Migration(migrations.Migration):
    dependencies = [("services", "0001_initial")]
    operations = [migrations.RunPython(seed_categories, migrations.RunPython.noop)]
