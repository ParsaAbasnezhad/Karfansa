import json

import pytest
from django.contrib.auth import get_user_model
from django.test import Client

from apps.geography.models import City, Province


@pytest.mark.django_db
def test_registration_and_password_login_use_csrf_protected_sessions() -> None:
    client = Client(enforce_csrf_checks=True)
    registration = {
        "email": "user@example.com",
        "phone": "+989121234567",
        "password": "Qw9!sX4mN2#kL7pV",
    }

    rejected = client.post(
        "/api/v1/auth/register",
        data=json.dumps(registration),
        content_type="application/json",
    )
    assert rejected.status_code == 403

    csrf_response = client.get("/api/v1/auth/csrf")
    assert csrf_response.status_code == 200
    token = csrf_response.json()["message"]
    assert client.cookies["csrftoken"].value

    invalid_email = client.post(
        "/api/v1/auth/register",
        data=json.dumps({**registration, "email": "not-an-email"}),
        content_type="application/json",
        HTTP_X_CSRFTOKEN=token,
    )
    assert invalid_email.status_code == 400

    registered = client.post(
        "/api/v1/auth/register",
        data=json.dumps(registration),
        content_type="application/json",
        HTTP_X_CSRFTOKEN=token,
    )
    assert registered.status_code == 201
    user = get_user_model().objects.get(email=registration["email"])
    assert user.check_password(registration["password"])

    duplicate = client.post(
        "/api/v1/auth/register",
        data=json.dumps(registration),
        content_type="application/json",
        HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
    )
    assert duplicate.status_code == 409

    logged_in = client.post(
        "/api/v1/auth/password-login",
        data=json.dumps(
            {"email": registration["email"], "password": registration["password"]}
        ),
        content_type="application/json",
        HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
    )
    assert logged_in.status_code == 200
    assert logged_in.json() == {"email": registration["email"], "phone": registration["phone"]}

    current_user = client.get("/api/v1/auth/me")
    assert current_user.status_code == 200
    profile_payload = current_user.json()
    assert {
        key: profile_payload[key]
        for key in ("email", "phone", "first_name", "last_name")
    } == {
        "email": registration["email"],
        "phone": registration["phone"],
        "first_name": "",
        "last_name": "",
    }
    assert profile_payload["date_joined"]
    province = Province.objects.get(name_fa="تهران")
    city = City.objects.filter(province=province).first()
    assert city is not None
    cities_response = client.get(
        f"/api/v1/geography/cities/?province_id={province.pk}"
    )
    assert cities_response.status_code == 200
    assert cities_response.json()
    assert all(item["province_id"] == province.pk for item in cities_response.json())

    updated_profile = client.patch(
        "/api/v1/auth/me",
        data=json.dumps(
            {
                "first_name": "سارا",
                "last_name": "احمدی",
                "province_id": province.pk,
                "city_id": city.pk,
            }
        ),
        content_type="application/json",
        HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
    )
    assert updated_profile.status_code == 200
    assert updated_profile.json()["first_name"] == "سارا"
    assert updated_profile.json()["last_name"] == "احمدی"
    assert updated_profile.json()["province_id"] == province.pk
    assert updated_profile.json()["city_id"] == city.pk

    another_province = Province.objects.exclude(pk=province.pk).first()
    assert another_province is not None
    other_city = City.objects.filter(province=another_province).first()
    assert other_city is not None
    mismatched_location = client.patch(
        "/api/v1/auth/me",
        data=json.dumps(
            {
                "first_name": "سارا",
                "last_name": "احمدی",
                "province_id": province.pk,
                "city_id": other_city.pk,
            }
        ),
        content_type="application/json",
        HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
    )
    assert mismatched_location.status_code == 400
