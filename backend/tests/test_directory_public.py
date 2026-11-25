import pytest
from django.test import Client

from apps.accounts.models import User
from apps.core.verification import VerificationStatus
from apps.services.models import SellerProfile
from tests.factories import make_organization, province

pytestmark = pytest.mark.django_db


def _user(email: str, phone: str) -> User:
    return User.objects.create_user(email=email, phone=phone, password="DirectoryPass123!")


def test_organizations_directory_is_mounted_and_filterable(client: Client) -> None:
    make_organization(name="فولاد پویا", english_name="Pooya Steel", is_verified=True)
    make_organization(name="بازرگانی خاموش", is_active=False)

    response = client.get("/api/v1/organizations/?search=فولاد")
    assert response.status_code == 200
    body = response.json()
    assert body["count"] == 1
    assert body["items"][0]["name"] == "فولاد پویا"
    assert body["items"][0]["is_verified"] is True


def test_individuals_directory_hides_private_and_supports_filters(client: Client) -> None:
    owner = _user("seller-dir@example.com", "09120001111")
    other = _user("hidden-dir@example.com", "09120001112")
    tehran = province("tehran")
    SellerProfile.objects.create(
        user=owner,
        display_name="باغبان نمونه",
        professional_title="کشاورز",
        bio="تولید سبزیجات",
        province=tehran,
        is_public=True,
        verification_status=VerificationStatus.VERIFIED,
    )
    SellerProfile.objects.create(
        user=other,
        display_name="پنهان",
        is_public=False,
        verification_status=VerificationStatus.DRAFT,
    )

    listed = client.get("/api/v1/individuals/?q=باغبان&verified=true")
    assert listed.status_code == 200
    body = listed.json()
    assert body["count"] == 1
    assert body["results"][0]["display_name"] == "باغبان نمونه"
    assert body["results"][0]["is_verified"] is True

    detail = client.get(f"/api/v1/individuals/{body['results'][0]['id']}/")
    assert detail.status_code == 200
    assert "public_phone" not in detail.json()

    hidden = SellerProfile.objects.get(display_name="پنهان")
    assert client.get(f"/api/v1/individuals/{hidden.pk}/").status_code == 404
