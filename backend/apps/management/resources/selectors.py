"""Bounded management queries and safe record serialization."""

from collections.abc import Callable
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from django.db import models
from django.db.models import Q, QuerySet
from django.http import HttpRequest
from django.utils.dateparse import parse_date
from ninja.errors import HttpError

from apps.management.permissions import scope_queryset

from .registry import ResourceSpec


_ARABIC_TO_PERSIAN = str.maketrans("يىك٠١٢٣٤٥٦٧٨٩", "ییک۰۱۲۳۴۵۶۷۸۹")
_PERSIAN_TO_ARABIC = str.maketrans("یک۰۱۲۳۴۵۶۷۸۹", "يك٠١٢٣٤٥٦٧٨٩")


def search_variants(value: str) -> tuple[str, ...]:
    cleaned = " ".join(value.strip().split())[:100]
    return tuple({cleaned, cleaned.translate(_ARABIC_TO_PERSIAN), cleaned.translate(_PERSIAN_TO_ARABIC)} - {""})


def _related_fields(spec: ResourceSpec) -> tuple[str, ...]:
    concrete = {field.name: field for field in spec.model._meta.concrete_fields}
    return tuple(
        name for name in spec.exposed_fields
        if name in concrete and concrete[name].is_relation and not concrete[name].one_to_many
    )


def base_queryset(request: HttpRequest, spec: ResourceSpec) -> QuerySet:
    queryset = spec.model._default_manager.all()
    relations = _related_fields(spec)
    if relations:
        queryset = queryset.select_related(*relations)
    if spec.writable_many_to_many:
        queryset = queryset.prefetch_related(*spec.writable_many_to_many)
    return scope_queryset(request, queryset)


def filtered_queryset(request: HttpRequest, spec: ResourceSpec) -> QuerySet:
    queryset = base_queryset(request, spec)
    params = request.GET
    query = params.get("q", "").strip()
    if query:
        if len(query) > 100:
            raise HttpError(400, "Search query is too long")
        search_filter = Q()
        for variant in search_variants(query):
            for field in spec.search_fields:
                search_filter |= Q(**{f"{field}__icontains": variant})
        if spec.search_fields:
            queryset = queryset.filter(search_filter)
    concrete = {field.name: field for field in spec.model._meta.concrete_fields}
    for name in spec.filter_fields:
        value = params.get(name)
        if value is None or value == "":
            continue
        field = _resolve_filter_field(spec.model, name)
        if isinstance(field, models.BooleanField):
            if value not in {"true", "false", "1", "0"}:
                raise HttpError(400, f"Invalid filter: {name}")
            value = value in {"true", "1"}
        queryset = queryset.filter(**{name: value})
    for name in ("created_at", "updated_at", "published_at"):
        if name not in concrete:
            continue
        for bound in ("from", "to"):
            raw = params.get(f"{name}_{bound}")
            if not raw:
                continue
            day = parse_date(raw)
            if day is None:
                raise HttpError(400, "Invalid date filter")
            lookup = "gte" if bound == "from" else "lte"
            queryset = queryset.filter(**{f"{name}__date__{lookup}": day})
    ordering = params.get("ordering", "")
    order_name = ordering.removeprefix("-")
    if ordering:
        if order_name not in set(spec.list_fields) | {"id", "created_at", "updated_at"}:
            raise HttpError(400, "Invalid ordering")
        if order_name not in concrete:
            raise HttpError(400, "Invalid ordering")
        queryset = queryset.order_by(ordering, "pk")
    elif "created_at" in concrete:
        queryset = queryset.order_by("-created_at", "-pk")
    else:
        queryset = queryset.order_by("pk")
    return queryset


# Read-only computed display columns mirroring Django admin ``@admin.display``.
COMPUTED_FIELDS: dict[tuple[str, str], tuple[str, Callable[[models.Model], object]]] = {
    ("geography.city", "country_name"): ("کشور", lambda obj: obj.province.country.name_fa),  # type: ignore[attr-defined]
}


def computed_field(spec: ResourceSpec, name: str) -> tuple[str, Callable[[models.Model], object]] | None:
    return COMPUTED_FIELDS.get((spec.slug, name))


def _resolve_filter_field(model: type[models.Model], name: str) -> models.Field:
    """Resolve a (possibly nested ``a__b__c``) filter to its terminal field."""
    parts = name.split("__")
    current = model
    field = None
    for index, part in enumerate(parts):
        try:
            field = current._meta.get_field(part)
        except Exception as exc:
            raise HttpError(400, f"Invalid filter: {name}") from exc
        if index < len(parts) - 1:
            if not field.is_relation or field.many_to_many or field.one_to_many:
                raise HttpError(400, f"Invalid filter: {name}")
            current = field.remote_field.model
    assert field is not None
    if field.many_to_many or field.one_to_many:
        raise HttpError(400, f"Invalid filter: {name}")
    return field


def _scalar(value: object) -> object:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, (Decimal, UUID)):
        return str(value)
    return value


def serialize_record(obj: models.Model, spec: ResourceSpec) -> dict[str, object]:
    fields = {field.name: field for field in obj._meta.concrete_fields}
    row: dict[str, object] = {}
    for name in spec.exposed_fields:
        computed = computed_field(spec, name)
        if computed is not None:
            row[name] = _scalar(computed[1](obj))
            continue
        field = fields.get(name) or obj._meta.get_field(name)
        if field is None:
            continue
        if field.many_to_many:
            related = getattr(obj, name).all()
            row[name] = [_scalar(value) for value in related.values_list("pk", flat=True)]
            row[f"{name}_label"] = [str(value) for value in related]
        elif isinstance(field, models.FileField):
            # Only known public images have URLs. Private storage keys and
            # attachment paths are never serialized.
            public_image = spec.slug in {
                "home.slide", "analysis.analysisauthor", "analysis.analysisreport",
                "advertising.advertisement", "geography.province",
                "organizations.industry", "organizations.organization",
                "services.sellerprofile", "services.listingimage",
                "transportation.transportcompany",
            }
            file = getattr(obj, name)
            row[name] = file.url if public_image and file else None
        elif field.is_relation:
            row[name] = _scalar(getattr(obj, field.attname))
            related = getattr(obj, name, None)
            row[f"{name}_label"] = str(related) if related is not None else None
        else:
            row[name] = _scalar(getattr(obj, name))
    return row


def page_size(request: HttpRequest) -> tuple[int, int]:
    try:
        page = int(request.GET.get("page", "1"))
        size = int(request.GET.get("page_size", "25"))
    except ValueError as exc:
        raise HttpError(400, "Invalid pagination") from exc
    if page < 1 or not 1 <= size <= 100:
        raise HttpError(400, "Invalid pagination")
    return page, size
