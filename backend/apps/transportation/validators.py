import re
from urllib.parse import urlsplit

from django.core.exceptions import ValidationError


def _validate_social_contact(
    value: str, *, username_pattern: str, hosts: set[str], path_pattern: str
) -> None:
    if not value:
        return

    username = value[1:] if value.startswith("@") else value
    if re.fullmatch(username_pattern, username):
        return

    try:
        url = urlsplit(value)
        hostname = (url.hostname or "").lower()
        port = url.port
    except ValueError as exc:
        raise ValidationError("Enter a valid secure social profile link or username.") from exc

    if (
        url.scheme != "https"
        or hostname not in hosts
        or url.username
        or url.password
        or port
        or not re.fullmatch(path_pattern, url.path)
    ):
        raise ValidationError("Enter a valid secure social profile link or username.")


def validate_telegram_contact(value: str) -> None:
    _validate_social_contact(
        value,
        username_pattern=r"[A-Za-z0-9_]{5,32}",
        hosts={"t.me", "telegram.me"},
        path_pattern=r"/(?:[A-Za-z0-9_]{5,32}|\+[A-Za-z0-9_-]+)/?",
    )


def validate_instagram_contact(value: str) -> None:
    username_pattern = r"(?!\.)(?!.*\.\.)[A-Za-z0-9._]{1,30}(?<!\.)"
    _validate_social_contact(
        value,
        username_pattern=username_pattern,
        hosts={"instagram.com", "www.instagram.com"},
        path_pattern=rf"/({username_pattern})/?",
    )
