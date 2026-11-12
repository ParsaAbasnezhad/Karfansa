from django.db import migrations, models


def create_default_content(apps, schema_editor):
    content_model = apps.get_model("home", "AboutPageContent")
    content_model.objects.get_or_create(
        pk=1,
        defaults={
            "hero_title": "تجارت، از اطلاعات روشن و ارتباط مؤثر آغاز می‌شود.",
            "hero_intro": (
                "کارفنسا ابزارهایی برای پیدا کردن محصول، آشنایی با فرصت‌های تجاری "
                "و دنبال‌کردن اطلاعات اقتصادی در اختیار فعالان کسب‌وکار قرار می‌دهد."
            ),
            "story_title": "پراکندگی اطلاعات را به مسیری روشن‌تر برای تجارت تبدیل می‌کنیم.",
            "story_body": (
                "شناخت بازار و پیدا کردن طرف تجاری مناسب، به اطلاعات قابل اتکا و راه ارتباطی روشن "
                "نیاز دارد. کارفنسا با کنار هم قراردادن بازار محصولات، فرصت‌های تجاری و داده‌های "
                "اقتصادی، به فعالان کسب‌وکار کمک می‌کند مسیرهای موجود را بهتر ببینند.\n"
                "آنچه در این صفحه معرفی می‌شود بر اساس امکانات فعال سامانه است؛ آمار نیز از API "
                "دریافت می‌شود و در صورت نبود داده، عددی نمایش داده نخواهد شد."
            ),
            "mission_title": "مسیر ساده‌تری برای پیدا کردن فرصت بسازیم.",
            "mission_body": (
                "اطلاعات محصول، بازار، استان و فرصت را در تجربه‌ای قابل جست‌وجو و قابل پیگیری کنار هم "
                "قرار دهیم."
            ),
            "vision_title": "ارتباطات تجاری را آگاهانه‌تر و دسترس‌پذیرتر کنیم.",
            "vision_body": (
                "با توسعهٔ تدریجی داده‌ها و ابزارهای واقعی، تصمیم‌گیری و همکاری میان فعالان اقتصادی "
                "را پشتیبانی کنیم."
            ),
        },
    )


class Migration(migrations.Migration):
    dependencies = [
        ("home", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="AboutPageContent",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("hero_title", models.CharField(max_length=200, verbose_name="عنوان اصلی")),
                ("hero_intro", models.TextField(verbose_name="معرفی کوتاه")),
                ("story_title", models.CharField(max_length=200, verbose_name="عنوان داستان")),
                ("story_body", models.TextField(verbose_name="متن داستان")),
                ("mission_title", models.CharField(max_length=200, verbose_name="عنوان مأموریت")),
                ("mission_body", models.TextField(verbose_name="متن مأموریت")),
                ("vision_title", models.CharField(max_length=200, verbose_name="عنوان چشم‌انداز")),
                ("vision_body", models.TextField(verbose_name="متن چشم‌انداز")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="آخرین ویرایش")),
            ],
            options={
                "verbose_name": "محتوای صفحه درباره ما",
                "verbose_name_plural": "محتوای صفحه درباره ما",
            },
        ),
        migrations.RunPython(create_default_content, migrations.RunPython.noop),
    ]
