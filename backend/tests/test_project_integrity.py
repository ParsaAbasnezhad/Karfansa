"""Project-level guard rails: migrations are in sync and production settings are safe."""

import os
import secrets
import subprocess
import sys
from pathlib import Path

import pytest
from django.core.management import call_command

BACKEND_DIR = Path(__file__).resolve().parents[1]


def _production_env(**overrides: str) -> dict[str, str]:
    env = {
        **os.environ,
        "DJANGO_SETTINGS_MODULE": "config.settings.production",
        "DJANGO_SECRET_KEY": secrets.token_urlsafe(64),
        "DJANGO_ALLOWED_HOSTS": "karfansa.example",
    }
    env.update(overrides)
    return env


def _manage(*args: str, env: dict[str, str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(  # noqa: S603
        [sys.executable, "manage.py", *args],
        cwd=BACKEND_DIR,
        env=env,
        capture_output=True,
        text=True,
        timeout=120,
        check=False,
    )


@pytest.mark.django_db
def test_no_missing_migrations() -> None:
    call_command("makemigrations", "--check", "--dry-run")


def test_production_settings_pass_deploy_checks() -> None:
    result = _manage("check", "--deploy", "--fail-level", "WARNING", env=_production_env())

    assert result.returncode == 0, result.stdout + result.stderr


def test_production_rejects_weak_secret_key() -> None:
    result = _manage("check", env=_production_env(DJANGO_SECRET_KEY="dev-only-insecure-key"))

    assert result.returncode != 0
    assert "DJANGO_SECRET_KEY" in result.stderr


def test_production_requires_allowed_hosts() -> None:
    result = _manage("check", env=_production_env(DJANGO_ALLOWED_HOSTS=""))

    assert result.returncode != 0
    assert "DJANGO_ALLOWED_HOSTS" in result.stderr


def test_production_forces_password_only_management_auth() -> None:
    result = _manage(
        "shell",
        "-c",
        "from django.conf import settings; "
        "assert settings.MANAGEMENT_MFA_REQUIRED is False; "
        "print('password-only')",
        env=_production_env(MANAGEMENT_MFA_REQUIRED="true"),
    )

    assert result.returncode == 0, result.stdout + result.stderr
    assert "password-only" in result.stdout
