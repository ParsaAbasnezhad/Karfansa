"""The API error envelope, exercised on an isolated NinjaAPI instance."""

from http import HTTPStatus

import pytest
from django.http import Http404
from ninja import NinjaAPI
from ninja.testing import TestClient

from apps.core.errors import ApiError, register_exception_handlers

api = NinjaAPI(urls_namespace="test-errors")
register_exception_handlers(api)


@api.get("/api-error")
def raise_api_error(request: object) -> None:
    raise ApiError("Name is taken.", status_code=HTTPStatus.CONFLICT, details=[{"field": "name"}])


@api.get("/not-found")
def raise_not_found(request: object) -> None:
    raise Http404


@api.get("/typed")
def typed(request: object, count: int) -> dict[str, int]:
    return {"count": count}


@api.get("/boom")
def boom(request: object) -> None:
    raise RuntimeError("secret internal detail")


@pytest.fixture
def api_client() -> TestClient:
    return TestClient(api)


def test_api_error_uses_the_envelope(api_client: TestClient) -> None:
    response = api_client.get("/api-error")

    assert response.status_code == 409
    assert response.json() == {
        "error": {"code": "conflict", "message": "Name is taken.", "details": [{"field": "name"}]}
    }


def test_not_found_uses_the_envelope(api_client: TestClient) -> None:
    response = api_client.get("/not-found")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


def test_validation_error_is_422_with_details(api_client: TestClient) -> None:
    response = api_client.get("/typed?count=abc")

    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "validation_error"
    assert error["details"]


def test_unexpected_exception_does_not_leak_internals(api_client: TestClient) -> None:
    response = api_client.get("/boom")

    assert response.status_code == 500
    assert response.json()["error"] == {
        "code": "internal_error",
        "message": "An unexpected error occurred.",
        "details": None,
    }
    assert "secret" not in response.content.decode()
