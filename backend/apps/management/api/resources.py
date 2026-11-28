"""Finite, permission-checked management resource API."""

import csv
import json
from datetime import datetime
from io import StringIO
from typing import Any

from django.core.exceptions import ValidationError
from django.db import models, transaction
from django.db.models import FileField
from django.db.models.deletion import ProtectedError
from django.http import FileResponse, HttpRequest, HttpResponse
from django.utils import timezone
from ninja import File, Form, Router, Schema, Status, UploadedFile
from ninja.errors import HttpError
from PIL import Image, UnidentifiedImageError

from apps.core.validators import validate_image_extension, validate_image_size
from apps.management.audit import audit_management
from apps.management.permissions import (
    can_manage,
    management_actor,
    require_management,
    require_recent_reauthentication,
    scope_queryset,
)
from apps.management.resources.registry import (
    RESOURCE_MAP,
    RESOURCES,
    ResourceSpec,
    get_resource,
)
from apps.management.resources.inlines import get_inline, inlines_for
from apps.management.resources.selectors import (
    base_queryset,
    computed_field,
    filtered_queryset,
    page_size,
    serialize_record,
)
from apps.management.resources.services import perform_action, save_resource


def _force_inline_fk(data: dict[str, Any], fk_name: str, parent: Any) -> dict[str, Any]:
    cleaned = {key: value for key, value in data.items() if key not in {fk_name, "id"}}
    cleaned[fk_name] = str(parent.pk)
    return cleaned
from apps.management.schemas.security import BulkResourceIn, BulkResourceOut

router = Router()


class ResourcePayload(Schema):
    data: dict[str, Any]


class ActionPayload(Schema):
    reason: str = ""


class SchedulePayload(Schema):
    scheduled_for: datetime | None


class CredentialPayload(Schema):
    value: str


class TicketMessageOut(Schema):
    id: str
    sender: str
    sender_type: str
    message: str
    is_internal: bool
    created_at: datetime
    has_attachment: bool


_PRIVATE_CONTENT = {
    "organizations.verificationdocument",
    "services.productinquiry",
    "support.supportticket",
    "support.ticketmessage",
    "organizations.businessauditlog",
}

_PUBLIC_IMAGE_FIELDS: dict[str, frozenset[str]] = {
    "home.slide": frozenset({"image"}),
    "analysis.analysisauthor": frozenset({"profile_image"}),
    "analysis.analysisreport": frozenset({"cover_image"}),
    "advertising.advertisement": frozenset({"image"}),
    "geography.province": frozenset({"featured_image", "map_image"}),
    "organizations.industry": frozenset({"image"}),
    "organizations.organization": frozenset({"logo", "cover_image"}),
    "services.sellerprofile": frozenset({"profile_image", "cover_image"}),
    "services.listingimage": frozenset({"image"}),
    "transportation.transportcompany": frozenset({"logo", "cover_image"}),
}


def _spec(slug: str) -> ResourceSpec:
    spec = get_resource(slug)
    if spec is None:
        raise HttpError(404, "Resource not found")
    return spec


def _check(request: HttpRequest, spec: ResourceSpec, action: str = "view", obj: Any = None) -> Any:
    app_label, model_name = spec.slug.split(".", 1)
    actor = require_management(request, app_label, model_name, action, obj=obj)
    if (
        spec.slug == "accounts.user"
        and action in {"update", "delete", "suspend", "reactivate", "manage_permissions"}
        and obj is not None
        and obj.is_superuser
        and not actor.is_superuser
    ):
        raise HttpError(403, "Protected administrator")
    if action == "view" and spec.sensitive:
        require_management(request, app_label, model_name, "view_sensitive", obj=obj)
    return actor


def _item(request: HttpRequest, spec: ResourceSpec, item_id: str, lock: bool = False) -> Any:
    queryset = (
        scope_queryset(request, spec.model._default_manager.all()).select_for_update()
        if lock else base_queryset(request, spec)
    )
    try:
        obj = queryset.get(pk=item_id)
    except (spec.model.DoesNotExist, ValueError, TypeError) as exc:
        raise HttpError(404, "Record not found") from exc
    _check(request, spec, obj=obj)
    return obj


# Private file fields that may be uploaded through the management API. They rely
# on model validators and are never served via public media URLs.
_PRIVATE_FILE_FIELDS: dict[str, frozenset[str]] = {}


def _allowed_file_fields(spec: ResourceSpec) -> frozenset[str]:
    return _PUBLIC_IMAGE_FIELDS.get(spec.slug, frozenset()) | _PRIVATE_FILE_FIELDS.get(spec.slug, frozenset())


def _field_type(field: Any) -> str:
    if isinstance(field, FileField):
        return "file"
    if field.is_relation:
        return "relation"
    kind = field.get_internal_type()
    if kind in {"BooleanField", "NullBooleanField"}:
        return "boolean"
    if kind in {"IntegerField", "PositiveIntegerField", "PositiveSmallIntegerField", "PositiveBigIntegerField", "BigIntegerField", "FloatField", "DecimalField"}:
        return "number"
    if kind in {"DateField", "DateTimeField"}:
        return "date" if kind == "DateField" else "datetime"
    if kind == "JSONField":
        return "json"
    if kind == "TextField":
        return "textarea"
    return "text"


def _descriptor(actor: Any, spec: ResourceSpec) -> dict[str, Any]:
    app_label, model_name = spec.slug.split(".", 1)
    permissions = {
        "view": can_manage(actor, app_label, model_name, "view"),
        "create": spec.allow_create and can_manage(actor, app_label, model_name, "create"),
        "update": bool(spec.writable_fields or spec.writable_many_to_many) and can_manage(actor, app_label, model_name, "update"),
        "delete": spec.allow_delete and can_manage(actor, app_label, model_name, "delete"),
        "export": not spec.sensitive and can_manage(actor, app_label, model_name, "export"),
    }
    fields = []
    for name in spec.exposed_fields:
        computed = computed_field(spec, name)
        if computed is not None:
            fields.append({
                "name": name,
                "label": computed[0],
                "type": "text",
                "required": False,
                "read_only": True,
                "multiple": False,
                "choices": [],
                "related_resource": None,
            })
            continue
        field = spec.model._meta.get_field(name)
        related = field.remote_field.model._meta if field.is_relation else None
        related_slug = f"{related.app_label}.{related.model_name}" if related else None
        fields.append({
            "name": name,
            "label": str(field.verbose_name),
            "type": _field_type(field),
            "required": not field.blank and not field.null and not field.has_default(),
            "read_only": name not in (*spec.writable_fields, *spec.writable_many_to_many),
            "multiple": field.many_to_many,
            "choices": [{"value": value, "label": str(label)} for value, label in field.choices] if field.choices else [],
            "related_resource": related_slug if related_slug in RESOURCE_MAP else None,
        })
    actions = [
        {"key": action.key, "label": action.label, "tone": action.tone,
         "requires_reason": action.requires_reason}
        for action in spec.actions
        if can_manage(actor, app_label, model_name, action.permission)
    ]
    return {
        "slug": spec.slug,
        "title": spec.title,
        "group": spec.group,
        "list_fields": spec.list_fields,
        "search_fields": spec.search_fields,
        "filter_fields": spec.filter_fields,
        "fields": fields,
        "write_only_fields": [
            {"name": name, "label": str(spec.model._meta.get_field(name).verbose_name)}
            for name in spec.write_only_fields
        ],
        "actions": actions,
        "permissions": permissions,
        "uploadable_fields": sorted(_allowed_file_fields(spec)),
        "inlines": [
            {
                "key": inline.key,
                "title": inline.title,
                "child_slug": inline.child_slug,
                "fk_name": inline.fk_name,
                "can_add": inline.can_add and can_manage(actor, *inline.child_slug.split(".", 1), "create"),
                "can_delete": inline.can_delete and can_manage(actor, *inline.child_slug.split(".", 1), "delete"),
                "can_update": can_manage(actor, *inline.child_slug.split(".", 1), "update"),
            }
            for inline in inlines_for(spec.slug)
        ],
    }


@router.get("/support/supportticket/{item_id}/messages", response=list[TicketMessageOut])
def list_ticket_messages(request: HttpRequest, item_id: str) -> list[dict[str, Any]]:
    spec = _spec("support.supportticket")
    ticket = _item(request, spec, item_id)
    from apps.support.models import TicketMessage

    messages = (
        TicketMessage.objects.filter(ticket=ticket)
        .select_related("sender")
        .order_by("created_at")
    )
    return [
        {
            "id": str(message.pk),
            "sender": str(message.sender) if message.sender else "سیستم",
            "sender_type": message.sender_type,
            "message": message.message,
            "is_internal": message.is_internal,
            "created_at": message.created_at,
            "has_attachment": bool(message.attachment),
        }
        for message in messages
    ]


@router.post("/support/supportticket/{item_id}/messages", response={201: TicketMessageOut})
def create_ticket_message(
    request: HttpRequest,
    item_id: str,
    message: str = Form(...),  # type: ignore[type-arg]
    internal_note: bool = Form(False),  # type: ignore[type-arg]
    attachment: UploadedFile | None = File(None),  # type: ignore[type-arg]
) -> Status[TicketMessageOut]:
    from apps.core.errors import ApiError
    from apps.support.services import add_internal_note, add_staff_reply

    if len(message) > 5000:
        raise HttpError(422, "Message is too long")
    spec = _spec("support.supportticket")
    with transaction.atomic():
        ticket = _item(request, spec, item_id, lock=True)
        actor = _check(request, spec, "update", obj=ticket)
        require_recent_reauthentication(request)
        try:
            if internal_note:
                if attachment is not None:
                    raise HttpError(422, "Attachments are not supported for internal notes")
                item = add_internal_note(ticket=ticket, sender=actor, message=message)
            else:
                item = add_staff_reply(
                    ticket=ticket,
                    sender=actor,
                    message=message,
                    attachment=attachment,
                )
        except ApiError as exc:
            raise HttpError(exc.status_code, exc.message) from exc
        audit_management(
            request,
            "support.ticket_internal_note" if internal_note else "support.ticket_reply",
            ticket,
            ("messages", "attachment") if attachment else ("messages",),
        )
    return Status(201, {
        "id": str(item.pk),
        "sender": str(actor),
        "sender_type": item.sender_type,
        "message": item.message,
        "is_internal": item.is_internal,
        "created_at": item.created_at,
        "has_attachment": bool(item.attachment),
    })


@router.get("/support/supportticket/{item_id}/messages/{message_id}/attachment")
def download_ticket_attachment(request: HttpRequest, item_id: str, message_id: str) -> FileResponse:
    spec = _spec("support.supportticket")
    ticket = _item(request, spec, item_id)
    from apps.support.models import TicketMessage

    item = TicketMessage.objects.filter(ticket=ticket, pk=message_id).first()
    if item is None or not item.attachment:
        raise HttpError(404, "File not found")
    audit_management(request, "support.ticket_attachment_access", ticket)
    response = FileResponse(
        item.attachment.open("rb"),
        as_attachment=True,
        filename=f"ticket-{ticket.ticket_number}-attachment",
    )
    response["Cache-Control"] = "private, no-store"
    response["X-Content-Type-Options"] = "nosniff"
    response["Content-Type"] = "application/octet-stream"
    return response


@router.get("/")
def list_resources(request: HttpRequest) -> list[dict[str, Any]]:
    actor = management_actor(request)
    return [
        _descriptor(actor, spec) for spec in RESOURCES
        if can_manage(actor, *spec.slug.split(".", 1), "view")
        and (not spec.sensitive or can_manage(actor, *spec.slug.split(".", 1), "view_sensitive"))
    ]


@router.get("/{slug}/export.csv")
def export_csv(request: HttpRequest, slug: str) -> HttpResponse:
    spec = _spec(slug)
    if spec.sensitive:
        raise HttpError(403, "Export is unavailable for this resource")
    _check(request, spec, "export")
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(spec.list_fields)
    rows = filtered_queryset(request, spec)[:1000]
    for obj in rows:
        data = serialize_record(obj, spec)
        values = []
        for name in spec.list_fields:
            value = str(data.get(name, "") or "")
            # Spreadsheet formula injection protection for CSV exports.
            values.append("'" + value if value.lstrip().startswith(("=", "+", "-", "@")) else value)
        writer.writerow(values)
    audit_management(request, "resource.export", spec.model())
    response = HttpResponse("\ufeff" + output.getvalue(), content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = f'attachment; filename="{spec.slug}.csv"'
    response["Cache-Control"] = "private, no-store"
    return response


@router.get("/{slug}")
def list_records(request: HttpRequest, slug: str) -> dict[str, Any]:
    spec = _spec(slug)
    _check(request, spec)
    page, size = page_size(request)
    queryset = filtered_queryset(request, spec)
    total = queryset.count()
    items = [serialize_record(obj, spec) for obj in queryset[(page - 1) * size : page * size]]
    return {"items": items, "total": total, "page": page, "page_size": size}


@router.post("/{slug}")
def create_record(request: HttpRequest, slug: str, payload: ResourcePayload) -> dict[str, Any]:
    spec = _spec(slug)
    if not spec.allow_create:
        raise HttpError(405, "Creation is unavailable for this resource")
    _check(request, spec, "create")
    obj = save_resource(request, spec, payload.data)
    return serialize_record(obj, spec)


@router.post("/{slug}/bulk", response=BulkResourceOut)
def bulk_resource_action(
    request: HttpRequest, slug: str, payload: BulkResourceIn
) -> BulkResourceOut:
    spec = _spec(slug)
    if not payload.ids or len(payload.ids) > 100 or len(set(payload.ids)) != len(payload.ids):
        raise HttpError(400, "Select between 1 and 100 unique records")
    deleting = payload.action == "delete"
    selected = next((item for item in spec.actions if item.key == payload.action), None)
    if deleting:
        if not spec.allow_delete:
            raise HttpError(405, "Deletion is unavailable for this resource")
    elif selected is None:
        raise HttpError(404, "Unknown action")
    if spec.sensitive or deleting:
        require_recent_reauthentication(request)

    processed: list[str] = []
    with transaction.atomic():
        for item_id in payload.ids:
            obj = _item(request, spec, item_id, lock=True)
            if deleting:
                _check(request, spec, "delete", obj=obj)
                audit_management(request, "resource.delete", obj)
                try:
                    obj.delete()
                except ProtectedError as exc:
                    raise HttpError(409, "A selected record is referenced by other records") from exc
            else:
                assert selected is not None
                _check(request, spec, selected.permission, obj=obj)
                perform_action(request, spec, obj, payload.action, payload.reason)
            processed.append(item_id)
    return BulkResourceOut(processed=len(processed), ids=processed)


class InlineSyncIn(Schema):
    creates: list[dict[str, Any]] = []
    updates: list[dict[str, Any]] = []
    deletes: list[str] = []


def _inline(request: HttpRequest, slug: str, key: str):  # type: ignore[no-untyped-def]
    inline = get_inline(slug, key)
    if inline is None:
        raise HttpError(404, "Inline not found")
    return inline


@router.get("/{slug}/{item_id}/inlines/{key}")
def list_inline(request: HttpRequest, slug: str, item_id: str, key: str) -> list[dict[str, Any]]:
    parent_spec = _spec(slug)
    parent = _item(request, parent_spec, item_id)
    inline = _inline(request, slug, key)
    child_spec = _spec(inline.child_slug)
    _check(request, child_spec, "view")
    queryset = scope_queryset(request, child_spec.model._default_manager.filter(**{inline.fk_name: parent}))
    queryset = queryset.order_by("pk")
    return [serialize_record(obj, child_spec) for obj in queryset]


@router.post("/{slug}/{item_id}/inlines/{key}/sync")
def sync_inline(request: HttpRequest, slug: str, item_id: str, key: str, payload: InlineSyncIn) -> dict[str, Any]:
    parent_spec = _spec(slug)
    inline = _inline(request, slug, key)
    child_spec = _spec(inline.child_slug)
    app_label, model_name = child_spec.slug.split(".", 1)
    with transaction.atomic():
        parent = _item(request, parent_spec, item_id, lock=True)
        _check(request, parent_spec, "update", obj=parent)
        _check(request, child_spec, "view")
        if child_spec.sensitive:
            require_recent_reauthentication(request)
        processed = {"created": [], "updated": [], "deleted": []}
        # Deletes
        if payload.deletes:
            if not inline.can_delete:
                raise HttpError(405, "Inline deletion is unavailable")
            for child_id in payload.deletes:
                child = _get_inline_child(request, child_spec, inline, parent, child_id)
                _check(request, child_spec, "delete", obj=child)
                audit_management(request, "resource.delete", child)
                try:
                    child.delete()
                except ProtectedError as exc:
                    raise HttpError(409, "A child record is referenced by other records") from exc
                processed["deleted"].append(str(child_id))
        # Updates
        for update in payload.updates:
            child_id = update.get("id")
            if child_id is None:
                raise HttpError(422, "Inline update requires id")
            child = _get_inline_child(request, child_spec, inline, parent, str(child_id))
            _check(request, child_spec, "update", obj=child)
            data = _force_inline_fk(update, inline.fk_name, parent)
            updated = save_resource(request, child_spec, data, child)
            processed["updated"].append(str(updated.pk))
        # Creates
        if payload.creates:
            if not inline.can_add:
                raise HttpError(405, "Inline creation is unavailable")
            for create in payload.creates:
                _check(request, child_spec, "create")
                data = _force_inline_fk(create, inline.fk_name, parent)
                child = save_resource(request, child_spec, data)
                processed["created"].append(str(child.pk))
    return processed


def _get_inline_child(request: HttpRequest, child_spec: ResourceSpec, inline, parent: Any, child_id: str) -> Any:  # type: ignore[no-untyped-def]
    try:
        queryset = scope_queryset(request, child_spec.model._default_manager.filter(**{inline.fk_name: parent}))
        return queryset.get(pk=child_id)
    except (child_spec.model.DoesNotExist, ValueError, TypeError) as exc:
        raise HttpError(404, "Child record not found") from exc


@router.get("/{slug}/{item_id}")
def get_record(request: HttpRequest, slug: str, item_id: str) -> dict[str, Any]:
    spec = _spec(slug)
    _check(request, spec)
    obj = _item(request, spec, item_id)
    if spec.slug in _PRIVATE_CONTENT:
        audit_management(request, "resource.sensitive_view", obj)
    return serialize_record(obj, spec)


@router.patch("/{slug}/{item_id}")
def update_record(request: HttpRequest, slug: str, item_id: str, payload: ResourcePayload) -> dict[str, Any]:
    spec = _spec(slug)
    with transaction.atomic():
        obj = _item(request, spec, item_id, lock=True)
        _check(request, spec, "update", obj=obj)
        if spec.sensitive:
            require_recent_reauthentication(request)
        updated = save_resource(request, spec, payload.data, obj)
    return serialize_record(updated, spec)


@router.delete("/{slug}/{item_id}")
def delete_record(request: HttpRequest, slug: str, item_id: str) -> dict[str, bool]:
    spec = _spec(slug)
    if not spec.allow_delete:
        raise HttpError(405, "Deletion is unavailable for this resource")
    with transaction.atomic():
        obj = _item(request, spec, item_id, lock=True)
        _check(request, spec, "delete", obj=obj)
        require_recent_reauthentication(request)
        audit_management(request, "resource.delete", obj)
        try:
            obj.delete()
        except ProtectedError as exc:
            raise HttpError(409, "Record is referenced by other records") from exc
    return {"deleted": True}


@router.post("/{slug}/{item_id}/actions/{action}")
def run_action(request: HttpRequest, slug: str, item_id: str, action: str, payload: ActionPayload) -> dict[str, Any]:
    spec = _spec(slug)
    selected = next((item for item in spec.actions if item.key == action), None)
    if selected is None:
        raise HttpError(404, "Unknown action")
    with transaction.atomic():
        obj = _item(request, spec, item_id, lock=True)
        _check(request, spec, selected.permission, obj=obj)
        if spec.sensitive:
            require_recent_reauthentication(request)
        updated = perform_action(request, spec, obj, action, payload.reason)
    return serialize_record(updated, spec)


@router.post("/{slug}/{item_id}/schedule")
def schedule_publication(request: HttpRequest, slug: str, item_id: str, payload: SchedulePayload) -> dict[str, Any]:
    spec = _spec(slug)
    if spec.slug != "trade.tradeopportunity":
        raise HttpError(404, "Scheduling is unavailable")
    with transaction.atomic():
        obj = _item(request, spec, item_id, lock=True)
        _check(request, spec, "publish", obj=obj)
        require_recent_reauthentication(request)
        if obj.review_status != "approved" or obj.is_published:
            raise HttpError(409, "Only approved, unpublished opportunities can be scheduled")
        when = payload.scheduled_for
        if when is not None:
            if not timezone.is_aware(when) or when <= timezone.now() or when > timezone.now() + timezone.timedelta(days=365):
                raise HttpError(422, "Enter a future time within one year including a timezone")
            if obj.valid_until and timezone.localtime(when).date() > obj.valid_until:
                raise HttpError(422, "Scheduled time exceeds opportunity validity")
        obj.scheduled_for = when
        try:
            obj.full_clean()
        except ValidationError as exc:
            raise HttpError(422, str(exc.message_dict if hasattr(exc, "message_dict") else exc.messages)) from exc
        obj.save(update_fields=["scheduled_for", "updated_at"])
        audit_management(request, "trade.publication_scheduled" if when else "trade.schedule_cancelled", obj, ("scheduled_for",))
    return serialize_record(obj, spec)


@router.put("/{slug}/{item_id}/credentials/{field_name}")
def rotate_credential(
    request: HttpRequest,
    slug: str,
    item_id: str,
    field_name: str,
    payload: CredentialPayload,
) -> dict[str, bool]:
    spec = _spec(slug)
    if field_name not in spec.write_only_fields:
        raise HttpError(404, "Credential field not found")
    field = spec.model._meta.get_field(field_name)
    if not isinstance(field, models.CharField):
        raise HttpError(404, "Credential field not found")
    if not payload.value or len(payload.value) > field.max_length:
        raise HttpError(422, "Enter a valid credential")
    with transaction.atomic():
        obj = _item(request, spec, item_id, lock=True)
        _check(request, spec, "update", obj=obj)
        require_recent_reauthentication(request)
        setattr(obj, field_name, payload.value)
        obj.full_clean()
        obj.save(update_fields=[field_name, *(["updated_at"] if hasattr(obj, "updated_at") else [])])
        audit_management(request, f"{spec.slug}.credential_rotated", obj)
    return {"configured": True}


def _validate_upload(spec: ResourceSpec, field_name: str, upload: UploadedFile) -> None:
    if field_name not in _allowed_file_fields(spec):
        raise HttpError(404, "Upload field not found")
    field = spec.model._meta.get_field(field_name)
    if not isinstance(field, FileField):
        raise HttpError(404, "Upload field not found")
    if field_name in _PUBLIC_IMAGE_FIELDS.get(spec.slug, frozenset()):
        try:
            validate_image_extension(upload)
            validate_image_size(upload)
            upload.seek(0)
            with Image.open(upload) as image:
                image.verify()
            upload.seek(0)
        except (ValidationError, UnidentifiedImageError, OSError) as exc:
            raise HttpError(422, "Invalid image. Use a JPG, PNG or WebP file up to 2 MB.") from exc


def _store_file(request: HttpRequest, spec: ResourceSpec, obj: Any, field_name: str, upload: UploadedFile) -> None:
    _validate_upload(spec, field_name, upload)
    setattr(obj, field_name, upload)
    try:
        obj.full_clean()
    except ValidationError as exc:
        raise HttpError(422, str(exc.message_dict if hasattr(exc, "message_dict") else exc.messages)) from exc
    obj.save(update_fields=[field_name, *(["updated_at"] if hasattr(obj, "updated_at") else [])])
    if spec.slug == "services.listingimage" and obj.listing.status == obj.listing.Status.APPROVED:
        obj.listing.transition_to(obj.listing.Status.PENDING_REVIEW)
        from apps.services.integrations import sync_product_opportunity

        sync_product_opportunity(obj.listing, reviewer=request.management_actor)
    audit_management(request, "resource.image_upload" if field_name in _PUBLIC_IMAGE_FIELDS.get(spec.slug, frozenset()) else "resource.file_upload", obj, (field_name,))


@router.post("/{slug}/{item_id}/files/{field_name}")
def upload_public_image(
    request: HttpRequest,
    slug: str,
    item_id: str,
    field_name: str,
    upload: UploadedFile = File(...),
) -> dict[str, Any]:
    spec = _spec(slug)
    _validate_upload(spec, field_name, upload)
    with transaction.atomic():
        obj = _item(request, spec, item_id, lock=True)
        _check(request, spec, "update", obj=obj)
        if spec.sensitive:
            require_recent_reauthentication(request)
        _store_file(request, spec, obj, field_name, upload)
    return serialize_record(obj, spec)


@router.post("/{slug}/{item_id}/files/{field_name}/clear")
def clear_file(request: HttpRequest, slug: str, item_id: str, field_name: str) -> dict[str, Any]:
    spec = _spec(slug)
    if field_name not in _allowed_file_fields(spec):
        raise HttpError(404, "File field not found")
    field = spec.model._meta.get_field(field_name)
    if not isinstance(field, FileField):
        raise HttpError(404, "File field not found")
    with transaction.atomic():
        obj = _item(request, spec, item_id, lock=True)
        _check(request, spec, "update", obj=obj)
        if spec.sensitive:
            require_recent_reauthentication(request)
        setattr(obj, field_name, None)
        try:
            obj.full_clean()
        except ValidationError as exc:
            raise HttpError(422, str(exc.message_dict if hasattr(exc, "message_dict") else exc.messages)) from exc
        obj.save(update_fields=[field_name, *(["updated_at"] if hasattr(obj, "updated_at") else [])])
        audit_management(request, "resource.file_clear", obj, (field_name,))
    return serialize_record(obj, spec)


@router.post("/{slug}/multipart")
def create_record_multipart(request: HttpRequest, slug: str) -> dict[str, Any]:
    spec = _spec(slug)
    if not spec.allow_create:
        raise HttpError(405, "Creation is unavailable for this resource")
    _check(request, spec, "create")
    raw = request.POST.get("data", "{}")
    try:
        payload = json.loads(raw) if raw else {}
    except json.JSONDecodeError as exc:
        raise HttpError(422, "Invalid multipart data") from exc
    if not isinstance(payload, dict):
        raise HttpError(422, "Invalid multipart data")
    file_fields = _allowed_file_fields(spec)
    uploads = [(name, f) for name, f in request.FILES.items() if name in file_fields]
    with transaction.atomic():
        obj = save_resource(request, spec, payload)
        for name, upload in uploads:
            _check(request, spec, "update", obj=obj)
            if spec.sensitive:
                require_recent_reauthentication(request)
            _store_file(request, spec, obj, name, upload)
    return serialize_record(obj, spec)


@router.patch("/{slug}/{item_id}/multipart")
def update_record_multipart(request: HttpRequest, slug: str, item_id: str) -> dict[str, Any]:
    spec = _spec(slug)
    raw = request.POST.get("data", "{}")
    try:
        payload = json.loads(raw) if raw else {}
    except json.JSONDecodeError as exc:
        raise HttpError(422, "Invalid multipart data") from exc
    if not isinstance(payload, dict):
        raise HttpError(422, "Invalid multipart data")
    file_fields = _allowed_file_fields(spec)
    uploads = [(name, f) for name, f in request.FILES.items() if name in file_fields]
    with transaction.atomic():
        obj = _item(request, spec, item_id, lock=True)
        _check(request, spec, "update", obj=obj)
        if spec.sensitive:
            require_recent_reauthentication(request)
        if payload:
            obj = save_resource(request, spec, payload, obj)
        for name, upload in uploads:
            _store_file(request, spec, obj, name, upload)
    return serialize_record(obj, spec)


@router.get("/{slug}/{item_id}/files/{field_name}/download")
def download_private_file(request: HttpRequest, slug: str, item_id: str, field_name: str) -> FileResponse:
    spec = _spec(slug)
    allowed = _PRIVATE_FILE_FIELDS.get(spec.slug, frozenset()) | (frozenset({"file"}) if spec.slug == "organizations.verificationdocument" else frozenset())
    if field_name not in allowed:
        raise HttpError(404, "File not found")
    obj = _item(request, spec, item_id)
    _check(request, spec, "view_sensitive", obj=obj)
    field = getattr(obj, field_name, None)
    if not field or not field.name:
        raise HttpError(404, "File not found")
    audit_management(request, "resource.private_file_access", obj, (field_name,))
    filename = field.name.rsplit("/", 1)[-1]
    response = FileResponse(field.open("rb"), as_attachment=True, filename=filename)
    response["Cache-Control"] = "private, no-store"
    response["X-Content-Type-Options"] = "nosniff"
    response["Content-Type"] = "application/octet-stream"
    return response


@router.get("/{slug}/{item_id}/private-file")
def private_file(request: HttpRequest, slug: str, item_id: str) -> FileResponse:
    spec = _spec(slug)
    if spec.slug != "organizations.verificationdocument":
        raise HttpError(404, "File not found")
    obj = _item(request, spec, item_id)
    _check(request, spec, "view_sensitive", obj=obj)
    if not obj.file:
        raise HttpError(404, "File not found")
    audit_management(request, "resource.private_document_access", obj)
    response = FileResponse(obj.file.open("rb"), as_attachment=True, filename=f"verification-document-{obj.pk}")
    response["Cache-Control"] = "private, no-store"
    response["X-Content-Type-Options"] = "nosniff"
    return response
