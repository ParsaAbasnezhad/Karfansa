from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone
import apps.core.uploads
import apps.core.validators


CAPITALS = {
    "east-azerbaijan": "تبریز",
    "west-azerbaijan": "ارومیه",
    "ardabil": "اردبیل",
    "isfahan": "اصفهان",
    "alborz": "کرج",
    "ilam": "ایلام",
    "bushehr": "بوشهر",
    "tehran": "تهران",
    "chaharmahal-and-bakhtiari": "شهرکرد",
    "south-khorasan": "بیرجند",
    "razavi-khorasan": "مشهد",
    "north-khorasan": "بجنورد",
    "khuzestan": "اهواز",
    "zanjan": "زنجان",
    "semnan": "سمنان",
    "sistan-and-baluchestan": "زاهدان",
    "fars": "شیراز",
    "qazvin": "قزوین",
    "qom": "قم",
    "kurdistan": "سنندج",
    "kerman": "کرمان",
    "kermanshah": "کرمانشاه",
    "kohgiluyeh-and-boyer-ahmad": "یاسوج",
    "golestan": "گرگان",
    "gilan": "رشت",
    "lorestan": "خرم آباد",
    "mazandaran": "ساری",
    "markazi": "اراک",
    "hormozgan": "بندرعباس",
    "hamadan": "همدان",
    "yazd": "یزد",
}


def normalize_name(value):
    return (
        value.replace("ي", "ی")
        .replace("ك", "ک")
        .replace(" ", "")
        .replace("\u200c", "")
        .replace("-", "")
    )


def populate_profiles(apps, schema_editor):
    Province = apps.get_model("geography", "Province")
    ProvinceCity = apps.get_model("geography", "City")
    from django.utils.text import slugify

    for province_slug, capital_name in CAPITALS.items():
        province = Province.objects.filter(
            slug=province_slug, country__iso2="IR"
        ).first()
        if province is None:
            continue
        city_rows = ProvinceCity.objects.filter(province_id=province.pk).order_by("pk")
        used_slugs = set()
        capital = None
        for city in city_rows:
            city_slug = slugify(city.name_fa, allow_unicode=True) or f"city-{city.pk}"
            if city_slug in used_slugs:
                city_slug = f"{city_slug}-{city.pk}"
            used_slugs.add(city_slug)
            city.slug = city_slug
            city.save(update_fields=["slug"])
            if normalize_name(city.name_fa) == normalize_name(capital_name):
                capital = city
        if capital is None:
            raise RuntimeError(f"Capital {capital_name} not found for province {province_slug}")
        province.capital_id = capital.pk
        province.is_published = True
        province.save(update_fields=["capital", "is_published"])


class Migration(migrations.Migration):
    dependencies = [
        ("geography", "0003_seed_iran_cities"),
    ]

    operations = [
        migrations.AddField(
            model_name="province",
            name="area_sq_km",
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                max_digits=12,
                null=True,
                verbose_name="مساحت (کیلومتر مربع)",
            ),
        ),
        migrations.AddField(
            model_name="province",
            name="created_at",
            field=models.DateTimeField(
                auto_now_add=True, default=django.utils.timezone.now, verbose_name="تاریخ ایجاد"
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="province",
            name="description",
            field=models.TextField(blank=True, verbose_name="معرفی کامل"),
        ),
        migrations.AddField(
            model_name="province",
            name="economic_description",
            field=models.TextField(blank=True, verbose_name="معرفی اقتصادی"),
        ),
        migrations.AddField(
            model_name="province",
            name="featured_image",
            field=models.ImageField(
                blank=True,
                upload_to=apps.core.uploads.UploadTo("geography/provinces/featured"),
                validators=[
                    apps.core.validators.validate_image_extension,
                    apps.core.validators.validate_image_size,
                ],
                verbose_name="تصویر شاخص",
            ),
        ),
        migrations.AddField(
            model_name="province",
            name="is_published",
            field=models.BooleanField(default=False, verbose_name="منتشر شده"),
        ),
        migrations.AddField(
            model_name="province",
            name="latitude",
            field=models.DecimalField(
                blank=True,
                decimal_places=6,
                max_digits=9,
                null=True,
                verbose_name="عرض جغرافیایی",
            ),
        ),
        migrations.AddField(
            model_name="province",
            name="longitude",
            field=models.DecimalField(
                blank=True,
                decimal_places=6,
                max_digits=9,
                null=True,
                verbose_name="طول جغرافیایی",
            ),
        ),
        migrations.AddField(
            model_name="province",
            name="map_image",
            field=models.ImageField(
                blank=True,
                upload_to=apps.core.uploads.UploadTo("geography/provinces/maps"),
                validators=[
                    apps.core.validators.validate_image_extension,
                    apps.core.validators.validate_image_size,
                ],
                verbose_name="تصویر نقشه",
            ),
        ),
        migrations.AddField(
            model_name="province",
            name="population",
            field=models.PositiveBigIntegerField(blank=True, null=True, verbose_name="جمعیت"),
        ),
        migrations.AddField(
            model_name="province",
            name="short_description",
            field=models.CharField(blank=True, max_length=300, verbose_name="معرفی کوتاه"),
        ),
        migrations.AddField(
            model_name="province",
            name="updated_at",
            field=models.DateTimeField(auto_now=True, verbose_name="تاریخ ویرایش"),
        ),
        migrations.AddField(
            model_name="city",
            name="description",
            field=models.TextField(blank=True, verbose_name="توضیحات"),
        ),
        migrations.AddField(
            model_name="city",
            name="is_county_center",
            field=models.BooleanField(default=False, verbose_name="مرکز شهرستان"),
        ),
        migrations.AddField(
            model_name="city",
            name="latitude",
            field=models.DecimalField(
                blank=True,
                decimal_places=6,
                max_digits=9,
                null=True,
                verbose_name="عرض جغرافیایی",
            ),
        ),
        migrations.AddField(
            model_name="city",
            name="longitude",
            field=models.DecimalField(
                blank=True,
                decimal_places=6,
                max_digits=9,
                null=True,
                verbose_name="طول جغرافیایی",
            ),
        ),
        migrations.AddField(
            model_name="city",
            name="population",
            field=models.PositiveBigIntegerField(blank=True, null=True, verbose_name="جمعیت"),
        ),
        migrations.AddField(
            model_name="city",
            name="slug",
            field=models.SlugField(blank=True, default="", verbose_name="نامک"),
        ),
        migrations.AddField(
            model_name="province",
            name="capital",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="capital_of",
                to="geography.city",
                verbose_name="مرکز استان",
            ),
        ),
        migrations.RunPython(populate_profiles, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="city",
            name="slug",
            field=models.SlugField(allow_unicode=True, verbose_name="نامک"),
        ),
        migrations.AddConstraint(
            model_name="city",
            constraint=models.UniqueConstraint(
                fields=("province", "slug"), name="geography_city_slug_unique"
            ),
        ),
    ]
