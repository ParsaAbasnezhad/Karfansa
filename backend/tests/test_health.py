import pytest
from django.test import Client

from apps.core.health import CheckResult


def test_liveness_reports_service_and_is_not_cached(client: Client) -> None:
    response = client.get("/api/v1/health/")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "karfansa-backend"
    assert body["version"]
    assert "no-store" in response["Cache-Control"]


@pytest.mark.django_db
def test_readiness_ok_with_real_database_and_redis(client: Client) -> None:
    response = client.get("/api/v1/health/ready/")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "checks": {"database": "ok", "redis": "ok"}}


@pytest.mark.django_db
def test_readiness_returns_503_when_a_dependency_fails(
    client: Client, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("apps.core.health.check_redis", lambda: CheckResult("redis", ok=False))

    response = client.get("/api/v1/health/ready/")

    assert response.status_code == 503
    assert response.json() == {
        "status": "unavailable",
        "checks": {"database": "ok", "redis": "error"},
    }


def test_openapi_schema_lists_health_endpoints(client: Client) -> None:
    response = client.get("/api/v1/openapi.json")

    assert response.status_code == 200
    paths = response.json()["paths"]
    assert "/api/v1/health/" in paths
    assert "/api/v1/health/ready/" in paths


def test_interactive_api_docs_are_served_in_development_mode(client: Client) -> None:
    response = client.get("/api/v1/docs")

    assert response.status_code == 200
