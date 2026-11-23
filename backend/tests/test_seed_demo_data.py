"""Safety checks for the development-only demo seeding command."""

from io import StringIO
from pathlib import Path

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import override_settings

from apps.accounts.models import User
from apps.organizations.models import Industry, Organization, OrganizationMember
from apps.services.models import (
    ListingImage,
    ProductInquiry,
    ProductListing,
    SellerProfile,
    ServiceCategory,
)
from apps.trade.models import TradeOpportunity


def test_seed_refuses_when_debug_is_false(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DJANGO_SETTINGS_MODULE", "config.settings.development")
    monkeypatch.setenv("KARFANSA_DEMO_SEED_LOCAL", "1")

    with override_settings(DEBUG=False), pytest.raises(CommandError, match="DEBUG=True"):
        call_command("seed_demo_data", dry_run=True)


def test_seed_refuses_production_settings_and_missing_marker(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    with override_settings(DEBUG=True):
        monkeypatch.setenv("DJANGO_SETTINGS_MODULE", "config.settings.production")
        monkeypatch.setenv("KARFANSA_DEMO_SEED_LOCAL", "1")
        with pytest.raises(CommandError, match="development settings"):
            call_command("seed_demo_data", dry_run=True)

        monkeypatch.setenv("DJANGO_SETTINGS_MODULE", "config.settings.development")
        monkeypatch.delenv("KARFANSA_DEMO_SEED_LOCAL", raising=False)
        with pytest.raises(CommandError, match="local Compose marker"):
            call_command("seed_demo_data", dry_run=True)


@pytest.mark.django_db
def test_seed_dry_run_preserves_database_and_media(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.setenv("DJANGO_SETTINGS_MODULE", "config.settings.development")
    monkeypatch.setenv("KARFANSA_DEMO_SEED_LOCAL", "1")
    sentinel = tmp_path / "existing.webp"
    sentinel.write_bytes(b"existing media")
    models = (
        User,
        Industry,
        ServiceCategory,
        Organization,
        OrganizationMember,
        SellerProfile,
        ProductListing,
        ListingImage,
        TradeOpportunity,
        ProductInquiry,
    )
    before = {model: model.objects.count() for model in models}
    output = StringIO()

    with override_settings(DEBUG=True, MEDIA_ROOT=tmp_path):
        call_command("seed_demo_data", dry_run=True, stdout=output)

    assert "Dry run" in output.getvalue()
    assert {model: model.objects.count() for model in models} == before
    assert list(tmp_path.rglob("*")) == [sentinel]
    assert sentinel.read_bytes() == b"existing media"


@pytest.mark.django_db
def test_seed_is_idempotent_and_preserves_unrelated_user(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.setenv("DJANGO_SETTINGS_MODULE", "config.settings.development")
    monkeypatch.setenv("KARFANSA_DEMO_SEED_LOCAL", "1")
    unrelated = User.objects.create_user(
        email="existing@example.invalid",
        phone="09120000001",
        password="UnrelatedAccount!2026",
        first_name="Existing",
    )
    original_user = tuple(
        User.objects.filter(pk=unrelated.pk).values_list(
            "email", "phone", "password", "first_name", "last_name"
        )[0]
    )

    with override_settings(DEBUG=True, MEDIA_ROOT=tmp_path):
        call_command("seed_demo_data", stdout=StringIO())
        first_counts = (
            Organization.objects.filter(slug__startswith="demo-karfansa-").count(),
            SellerProfile.objects.filter(user__email__endswith="@demo.karfansa.invalid").count(),
            ProductListing.objects.filter(slug__startswith="demo-karfansa-").count(),
            TradeOpportunity.objects.filter(slug__startswith="demo-karfansa-").count(),
            ProductInquiry.objects.filter(buyer__email__endswith="@demo.karfansa.invalid").count(),
        )
        first_images = {path.relative_to(tmp_path) for path in tmp_path.rglob("*.webp")}
        second_output = StringIO()
        call_command("seed_demo_data", stdout=second_output)

    assert first_counts == (12, 8, 45, 10, 20)
    assert len(first_images) == 85
    assert {path.relative_to(tmp_path) for path in tmp_path.rglob("*.webp")} == first_images
    assert "images: 0 created" in second_output.getvalue()
    assert "inquiries: 0 created" in second_output.getvalue()
    assert (
        tuple(
            User.objects.filter(pk=unrelated.pk).values_list(
                "email", "phone", "password", "first_name", "last_name"
            )[0]
        )
        == original_user
    )
