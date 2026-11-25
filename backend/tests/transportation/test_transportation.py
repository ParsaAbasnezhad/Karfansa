import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.test import Client

from apps.geography.models import Country
from apps.transportation.models import TransportMode, VehicleType
from tests.factories import make_organization, make_transport_company, province

pytestmark = pytest.mark.django_db


def test_transport_modes_are_seeded_in_order(client: Client) -> None:
    response = client.get("/api/v1/transport-companies/transport-types/")

    assert response.status_code == 200
    assert [m["code"] for m in response.json()] == [
        "road",
        "sea",
        "air",
        "rail",
        "multimodal",
        "warehouse",
        "international",
        "customs",
        "urban",
    ]
    assert all("company_count" in item for item in response.json())


def test_national_id_is_unique_only_when_filled() -> None:
    make_transport_company(national_id="")
    make_transport_company(national_id="")
    make_transport_company(national_id="20202020202")

    with pytest.raises(IntegrityError), transaction.atomic():
        make_transport_company(national_id="20202020202")


def test_filters_use_real_relations_and_do_not_duplicate_rows(client: Client) -> None:
    road, sea = TransportMode.objects.get(code="road"), TransportMode.objects.get(code="sea")
    both = make_transport_company(name="هر دو", customs_services=True)
    both.transport_types.set([road, sea])
    both.service_provinces.set([province("tehran"), province("fars")])
    only_sea = make_transport_company(name="فقط دریا")
    only_sea.transport_types.set([sea])
    make_transport_company(name="غیرفعال", is_active=False).transport_types.set([road])

    def names(query: str) -> list[str]:
        return [
            i["name"] for i in client.get(f"/api/v1/transport-companies/{query}").json()["items"]
        ]

    assert names("?transport_type=road") == ["هر دو"]
    assert sorted(names("?transport_type=sea")) == ["فقط دریا", "هر دو"]
    assert names("?service_province=fars") == ["هر دو"]
    assert names("?customs_services=true") == ["هر دو"]
    # A company matching two provinces of the filter must still appear exactly once.
    assert names("?search=هر") == ["هر دو"]


def test_city_and_coverage_filters(client: Client) -> None:
    iran = Country.objects.get(iso2="IR")
    tehran = province("tehran")
    local = make_transport_company(name="داخلی", province=tehran)
    local.service_provinces.set([tehran])
    abroad = make_transport_company(name="بین‌المللی")
    abroad.origin_countries.set([iran])

    def names(query: str) -> list[str]:
        return [
            i["name"] for i in client.get(f"/api/v1/transport-companies/{query}").json()["items"]
        ]

    assert names("?coverage=domestic") == ["داخلی"]
    assert names("?coverage=international") == ["بین‌المللی"]
    assert names(f"?province={tehran.pk}") == ["داخلی"]


def test_detail_includes_coverage_vehicles_and_countries(client: Client) -> None:
    iran = Country.objects.get(iso2="IR")
    carrier = make_transport_company(
        name="الف", english_name="Alpha Freight", fleet_capacity="۵۰ کامیون"
    )
    carrier.service_provinces.set([province("yazd")])
    carrier.origin_countries.set([iran])
    carrier.vehicle_types.set([VehicleType.objects.create(slug="truck", name_fa="کامیون")])

    body = client.get("/api/v1/transport-companies/alpha-freight/").json()

    assert body["service_provinces"][0]["slug"] == "yazd"
    assert body["origin_countries"][0]["iso2"] == "IR"
    assert body["vehicle_types"][0]["slug"] == "truck"
    assert body["fleet_capacity"] == "۵۰ کامیون"


def test_transport_companies_never_appear_in_the_companies_list(client: Client) -> None:
    make_transport_company(name="حمل")
    make_organization(name="شرکت")

    companies = client.get("/api/v1/organizations/").json()["items"]

    assert [c["name"] for c in companies] == ["شرکت"]


def test_public_detail_omits_registration_identifiers(client: Client) -> None:
    make_transport_company(
        name="الف",
        english_name="private-ids",
        national_id="30303030303",
        registration_number="9988",
    )

    body = client.get("/api/v1/transport-companies/private-ids/").json()

    assert "national_id" not in body
    assert "registration_number" not in body


def test_social_contact_fields_accept_profiles_and_reject_unsafe_values() -> None:
    company = make_transport_company(
        name="الف",
        english_name="social-contact-validation",
        telegram="@alpha_freight",
        instagram="alpha.freight",
    )
    company.full_clean()

    company.telegram = "javascript:alert(1)"
    with pytest.raises(ValidationError):
        company.full_clean()

    company.telegram = "https://example.com/alpha_freight"
    with pytest.raises(ValidationError):
        company.full_clean()

    company.telegram = "@alpha_freight"
    company.instagram = "https://instagram.com/alpha.freight/"
    company.full_clean()

    company.instagram = "http://www.instagram.com/alpha.freight/"
    with pytest.raises(ValidationError):
        company.full_clean()


def test_public_detail_includes_registered_contact_channels(client: Client) -> None:
    make_transport_company(
        name="الف",
        english_name="public-contact",
        phone="+982112345678",
        email="contact@example.com",
        telegram="@alpha_freight",
        instagram="alpha.freight",
    )

    body = client.get("/api/v1/transport-companies/public-contact/").json()

    assert body["phone"] == "+982112345678"
    assert body["email"] == "contact@example.com"
    assert body["telegram"] == "@alpha_freight"
    assert body["instagram"] == "alpha.freight"


def test_unknown_or_inactive_transport_company_is_404(client: Client) -> None:
    make_transport_company(name="x", english_name="hidden-carrier", is_active=False)

    assert client.get("/api/v1/transport-companies/hidden-carrier/").status_code == 404
