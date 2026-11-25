from django.db import migrations, models

import apps.transportation.validators


class Migration(migrations.Migration):
    dependencies = [("transportation", "0003_expand_transport_modes")]

    operations = [
        migrations.AlterField(
            model_name="transportcompany",
            name="telegram",
            field=models.CharField(
                blank=True,
                max_length=255,
                validators=[apps.transportation.validators.validate_telegram_contact],
            ),
        ),
        migrations.AddField(
            model_name="transportcompany",
            name="instagram",
            field=models.CharField(
                blank=True,
                max_length=255,
                validators=[apps.transportation.validators.validate_instagram_contact],
            ),
        ),
    ]
