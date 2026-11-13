import hashlib
import secrets
from pathlib import Path

from django.core.cache import cache
from django.http import FileResponse, HttpRequest
from django.views.decorators.csrf import csrf_protect
from ninja import File, Form, Router, Status, UploadedFile
from ninja.decorators import decorate_view

from apps.accounts.models import User
from apps.core.errors import ApiError

from .models import SenderType, SupportTicket, TicketMessage, TicketSource
from .schemas import (
    TicketCreatedOut,
    TicketCreateIn,
    TicketDetailOut,
    TicketListItemOut,
    TicketMessageOut,
    TicketPageOut,
)
from .selectors import (
    apply_ticket_filters,
    has_unread,
    paginate,
    summarize_tickets,
    tickets_for_user,
)
from .services import (
    add_user_message,
    close_ticket,
    create_support_ticket,
    hash_access_token,
    mark_ticket_read,
    public_messages,
)

router = Router()


def require_user(request: HttpRequest) -> User:
    if not request.user.is_authenticated:
        raise ApiError("برای ادامه وارد حساب کاربری شوید.", status_code=401)
    return request.user


def _throttle(request: HttpRequest, prefix: str, limit: int) -> None:
    remote_addr = request.META.get("REMOTE_ADDR", "unknown")
    user_part = str(getattr(request.user, "pk", "") or "anon")
    raw = f"{prefix}:{user_part}:{remote_addr}"
    throttle_id = hashlib.sha256(raw.encode()).hexdigest()
    key = f"support-ticket:{throttle_id}"
    cache.add(key, 0, timeout=3600)
    attempts = cache.incr(key)
    if attempts > limit:
        raise ApiError(
            "تعداد درخواست‌ها زیاد است. کمی بعد دوباره تلاش کنید.",  # noqa: RUF001
            status_code=429,
        )


def _resolve_ticket(
    request: HttpRequest, ticket_number: str, access_token: str = ""
) -> SupportTicket:
    ticket = (
        SupportTicket.objects.select_related("user", "assigned_to")
        .filter(ticket_number=ticket_number)
        .first()
    )
    if ticket is None:
        raise ApiError("تیکت پیدا نشد.", status_code=404)
    user = request.user if request.user.is_authenticated else None
    if user is not None and ticket.user_id == user.pk:
        return ticket
    token = access_token.strip()
    if token and ticket.access_token_hash:
        digest = hash_access_token(token)
        if secrets.compare_digest(digest, ticket.access_token_hash):
            return ticket
    raise ApiError("تیکت پیدا نشد.", status_code=404)


def _attachment_url(ticket: SupportTicket, message: TicketMessage) -> str | None:
    if not message.attachment:
        return None
    return f"/api/v1/support/tickets/{ticket.ticket_number}/messages/{message.pk}/attachment/"


def _message_out(ticket: SupportTicket, item: TicketMessage) -> TicketMessageOut:
    if item.sender_type == SenderType.STAFF:
        label = "پشتیبانی کارفنسا"
    elif item.sender_type == SenderType.SYSTEM:
        label = "سیستم"
    elif item.sender:
        name = f"{item.sender.first_name} {item.sender.last_name}".strip()
        label = name or ticket.contact_name or "شما"
    else:
        label = ticket.contact_name or "مهمان"
    filename = Path(item.attachment.name).name if item.attachment else None
    return TicketMessageOut(
        id=str(item.pk),
        sender_type=item.sender_type,
        sender_type_display=item.get_sender_type_display(),
        sender_label=label,
        message=item.message,
        attachment_url=_attachment_url(ticket, item),
        attachment_name=filename,
        created_at=item.created_at,
    )


def _list_item(ticket: SupportTicket) -> TicketListItemOut:
    return TicketListItemOut(
        id=str(ticket.pk),
        ticket_number=ticket.ticket_number,
        subject=ticket.subject,
        category=ticket.category,
        category_display=ticket.get_category_display(),
        priority=ticket.priority,
        status=ticket.status,
        status_display=ticket.get_status_display(),
        last_message_excerpt=ticket.last_message_excerpt,
        last_message_at=ticket.last_message_at,
        created_at=ticket.created_at,
        updated_at=ticket.updated_at,
        has_unread=has_unread(ticket),
        is_closed=ticket.is_closed,
    )


def _detail(ticket: SupportTicket, *, access_token: str | None = None) -> TicketDetailOut:
    base = _list_item(ticket)
    return TicketDetailOut(
        **base.model_dump(),
        contact_name=ticket.contact_name,
        contact_email=ticket.contact_email,
        contact_phone=ticket.contact_phone,
        source=ticket.source,
        closed_at=ticket.closed_at,
        access_token=access_token,
        messages=[_message_out(ticket, item) for item in public_messages(ticket)],
    )


@router.get("/tickets/", response=TicketPageOut, operation_id="support_ticket_list")
def list_tickets(
    request: HttpRequest,
    q: str = "",
    status: str = "",
    page: int = 1,
    page_size: int = 10,
) -> TicketPageOut:
    user = require_user(request)
    page = max(page, 1)
    page_size = min(max(page_size, 1), 50)
    scoped = tickets_for_user(user.pk)
    summary = summarize_tickets(scoped)
    filtered = apply_ticket_filters(scoped, query=q, status=status)
    items, count, total_pages = paginate(filtered, page=page, page_size=page_size)
    return TicketPageOut(
        results=[_list_item(ticket) for ticket in items],
        count=count,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        summary=summary,
    )


@router.post("/tickets/", response={201: TicketCreatedOut}, operation_id="support_ticket_create")
@decorate_view(csrf_protect)
def create_ticket(
    request: HttpRequest,
    payload: TicketCreateIn = Form(...),  # type: ignore[type-arg]  # noqa: B008
    attachment: UploadedFile | None = File(None),  # type: ignore[type-arg]  # noqa: B008
) -> Status[TicketCreatedOut]:
    if payload.website:
        raise ApiError("درخواست معتبر نیست.")
    user = request.user if request.user.is_authenticated else None
    _throttle(request, "create", 8 if user else 5)
    source = TicketSource.PROFILE if user else TicketSource.GUEST
    ticket, token = create_support_ticket(
        user=user,
        subject=payload.subject,
        message=payload.message,
        category=payload.category,
        priority=payload.priority,
        contact_name=payload.contact_name,
        contact_email=payload.contact_email,
        contact_phone=payload.contact_phone,
        source=source,
        attachment=attachment,
    )
    notice = "درخواست پشتیبانی ثبت شد."
    if token:
        notice = "درخواست پشتیبانی ثبت شد. شماره تیکت و کد پیگیری را نگه دارید."
    return Status(
        201,
        TicketCreatedOut(ticket_number=ticket.ticket_number, access_token=token, message=notice),
    )


@router.get(
    "/tickets/{ticket_number}/", response=TicketDetailOut, operation_id="support_ticket_detail"
)
def ticket_detail(
    request: HttpRequest,
    ticket_number: str,
    access_token: str = "",
) -> TicketDetailOut:
    ticket = _resolve_ticket(request, ticket_number, access_token)
    if request.user.is_authenticated and ticket.user_id == request.user.pk:
        mark_ticket_read(ticket)
        ticket.refresh_from_db()
    return _detail(ticket)


@router.post(
    "/tickets/{ticket_number}/messages/",
    response={201: TicketDetailOut},
    operation_id="support_ticket_message_create",
)
@decorate_view(csrf_protect)
def create_message(
    request: HttpRequest,
    ticket_number: str,
    message: str = Form(...),  # type: ignore[type-arg]
    access_token: str = Form(""),  # type: ignore[type-arg]
    attachment: UploadedFile | None = File(None),  # type: ignore[type-arg]  # noqa: B008
) -> Status[TicketDetailOut]:
    token = access_token or request.GET.get("access_token", "")
    ticket = _resolve_ticket(request, ticket_number, token)
    user = request.user if request.user.is_authenticated else None
    if user is not None and ticket.user_id != user.pk:
        raise ApiError("تیکت پیدا نشد.", status_code=404)
    add_user_message(ticket=ticket, sender=ticket.user, message=message, attachment=attachment)
    ticket.refresh_from_db()
    if ticket.user_id and user is not None:
        mark_ticket_read(ticket)
        ticket.refresh_from_db()
    return Status(201, _detail(ticket))


@router.post(
    "/tickets/{ticket_number}/close/",
    response=TicketDetailOut,
    operation_id="support_ticket_close",
)
@decorate_view(csrf_protect)
def close_user_ticket(
    request: HttpRequest,
    ticket_number: str,
    access_token: str = "",
) -> TicketDetailOut:
    ticket = _resolve_ticket(request, ticket_number, access_token)
    close_ticket(ticket, actor=request.user if request.user.is_authenticated else None)
    ticket.refresh_from_db()
    return _detail(ticket)


@router.get(
    "/tickets/{ticket_number}/messages/{message_id}/attachment/",
    operation_id="support_ticket_attachment",
)
def download_attachment(
    request: HttpRequest,
    ticket_number: str,
    message_id: str,
    access_token: str = "",
) -> FileResponse:
    ticket = _resolve_ticket(request, ticket_number, access_token)
    item = TicketMessage.objects.filter(pk=message_id, ticket=ticket).first()
    if item is None or item.is_internal or not item.attachment:
        raise ApiError("پیوست پیدا نشد.", status_code=404)
    handle = item.attachment.open("rb")
    filename = Path(item.attachment.name).name
    return FileResponse(handle, as_attachment=True, filename=filename)
