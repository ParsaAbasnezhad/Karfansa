import json

import pytest
from django.contrib.auth import get_user_model
from django.test import Client


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
    assert current_user.json() == {"email": registration["email"], "phone": registration["phone"]}
