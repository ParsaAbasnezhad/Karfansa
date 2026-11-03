from collections.abc import Collection, Mapping
from http import HTTPStatus

from apps.core.errors import ApiError


def ensure_transition(*, current: str, target: str, allowed: Mapping[str, Collection[str]]) -> None:
    """Raise a 409 error unless ``current -> target`` is an allowed status change."""
    if target not in allowed.get(current, ()):
        raise ApiError(
            f"Cannot change status from '{current}' to '{target}'.",
            status_code=HTTPStatus.CONFLICT,
            code="invalid_status_transition",
        )
