from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
from django.utils import timezone


def create_approved_service_opportunities(apps, schema_editor):
    ProductListing = apps.get_model("services", "ProductListing")
    TradeOpportunity = apps.get_model("trade", "TradeOpportunity")
    now = timezone.now()
    listings = ProductListing.objects.filter(
        status="approved",
        is_active=True,
    ).select_related("seller")
    for listing in listings.iterator():
        slug = f"service-product-{listing.pk}"
        suffix = 1
        while TradeOpportunity.objects.filter(slug=slug).exists():
            slug = f"service-product-{listing.pk}-{suffix}"
            suffix += 1
        TradeOpportunity.objects.create(
            title=listing.title,
            slug=slug,
            province_id=listing.province_id,
            city_id=listing.city_id,
            service_listing_id=listing.pk,
            opportunity_type="bulk-sell",
            description=listing.description,
            required_volume=listing.quantity,
            volume_unit=listing.unit,
            min_value=listing.price,
            max_value=listing.price,
            currency=listing.currency if listing.price is not None else "",
            source="محصول ثبت‌شده در بازار محصولات کارفنسا",
            created_by_id=listing.seller.user_id,
            published_at=now,
            review_status="approved",
            is_published=True,
            last_reviewed_at=now,
            last_reviewed_by_id=listing.reviewed_by_id,
        )


def remove_service_opportunities(apps, schema_editor):
    TradeOpportunity = apps.get_model("trade", "TradeOpportunity")
    TradeOpportunity.objects.filter(service_listing_id__isnull=False).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("services", "0002_seed_categories"),
        ("trade", "0003_tradeopportunity_trade_volume_idx"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="tradeopportunity",
            name="service_listing",
            field=models.OneToOneField(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="trade_opportunity",
                to="services.productlisting",
                verbose_name="محصول بازار خدمات",
            ),
        ),
        migrations.RunPython(create_approved_service_opportunities, remove_service_opportunities),
    ]
