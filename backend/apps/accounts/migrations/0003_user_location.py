import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0002_user_profile_names"),
        ("geography", "0003_seed_iran_cities"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="province",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="resident_users",
                to="geography.province",
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="city",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="resident_users",
                to="geography.city",
            ),
        ),
    ]
