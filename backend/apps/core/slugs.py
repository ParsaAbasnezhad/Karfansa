import uuid
from typing import Any

from django.db.models import Model
from django.utils.text import slugify


def build_unique_slug(
    model: type[Model],
    *candidates: str,
    fallback: str,
    scope: dict[str, Any] | None = None,
    max_length: int = 50,
) -> str:
    """Return a unique ASCII slug for ``model``.

    The first candidate that produces a non-empty ASCII slug wins (Persian text slugifies to
    an empty string, so an English name is the usual source). If none does, the slug is
    ``fallback`` plus a short random suffix. ``scope`` narrows uniqueness (for example to one
    organization).
    """
    base = next((slug for text in candidates if (slug := slugify(text))), "")
    if not base:
        return f"{fallback}-{uuid.uuid4().hex[:8]}"

    base = base[: max_length - 8]
    slug, counter = base, 2
    existing = model._default_manager.filter(**(scope or {}))
    while existing.filter(slug=slug).exists():
        slug = f"{base}-{counter}"
        counter += 1
    return slug
