"""Exercise the existing-inquiry backfill in an isolated throwaway database."""

import os
import sys
from pathlib import Path
from tempfile import TemporaryDirectory

BASE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BASE_DIR))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.test")
os.environ.setdefault("DJANGO_SECRET_KEY", "migration-verification-only")
os.environ.setdefault("POSTGRES_DB", "unused")
os.environ.setdefault("POSTGRES_USER", "unused")
os.environ.setdefault("POSTGRES_PASSWORD", "unused")


def main() -> None:
    from django.conf import settings

    with TemporaryDirectory(prefix="inquiry-migration-", dir=BASE_DIR) as directory:
        settings.DATABASES = {
            "default": {
                "ENGINE": "django.db.backends.sqlite3",
                "NAME": str(Path(directory) / "test.sqlite3"),
            },
        }
        import django
        from django.db import connection
        from django.db.migrations.executor import MigrationExecutor

        django.setup()
        old = [("services", "0004_alter_productlisting_options_and_more")]
        new = [("services", "0005_inquirymessage_inquirynotification_and_more")]
        executor = MigrationExecutor(connection)
        executor.migrate(old)
        historic = executor.loader.project_state(old).apps
        Country = historic.get_model("geography", "Country")
        Province = historic.get_model("geography", "Province")
        User = historic.get_model("accounts", "User")
        Seller = historic.get_model("services", "SellerProfile")
        Category = historic.get_model("services", "ServiceCategory")
        Listing = historic.get_model("services", "ProductListing")
        Inquiry = historic.get_model("services", "ProductInquiry")
        country, _ = Country.objects.get_or_create(
            iso2="IR", defaults={"name_fa": "ایران", "name_en": "Iran"},
        )
        location, _ = Province.objects.get_or_create(
            slug="tehran", defaults={
                "country": country, "name_fa": "تهران", "name_en": "Tehran",
            },
        )
        owner = User.objects.create(
            email="old-owner@example.com", phone="09127770018",
        )
        seller = Seller.objects.create(user=owner, display_name="فروشنده قدیمی")
        category = Category.objects.create(name="آزمون", slug="inquiry-old")
        item = Listing.objects.create(
            seller=seller, category=category, province=location,
            title="محصول قدیمی", description="آگهی قدیمی", quantity=10, unit="عدد",
        )
        for n in (19, 20):
            applicant = User.objects.create(
                email=f"old-buyer-{n}@example.com", phone=f"091277700{n}",
            )
            Inquiry.objects.create(listing=item, buyer=applicant, message="درخواست قدیمی")
        MigrationExecutor(connection).migrate(new)
        from apps.services.models import ProductInquiry

        rows = list(ProductInquiry.objects.order_by("pk"))
        if len(rows) != 2 or len({row.public_id for row in rows}) != 2:
            raise AssertionError("Existing inquiries did not receive distinct public IDs.")
        if any(row.owner_seller_id != seller.pk for row in rows):
            raise AssertionError("Existing inquiry ownership was not backfilled.")
        if any(row.subject != item.title for row in rows):
            raise AssertionError("Existing inquiry subjects were not backfilled.")
        connection.close()
    print("Existing inquiry migration backfill passed.")


if __name__ == "__main__":
    main()
