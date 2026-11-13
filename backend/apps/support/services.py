from __future__ import annotations

import hashlib
import secrets
from typing import TYPE_CHECKING

from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.files.uploadedfile import UploadedFile
from django.db import transaction
from django.db.models import QuerySet
from django.utils import timezone

from apps.core.errors import ApiError
from apps.core.workflow import ensure_transition

from .models import (
    CONTACT_SUBJECT_TO_CATEGORY,
    SenderType,
    SupportTicket,
    TicketCategory,
    TicketMessage,
    TicketPriority,
    TicketSource,
    TicketStatus,
)
from .notifications import notify_staff_replied, notify_ticket_created, notify_user_replied

if TYPE_CHECKING:
    from apps.accounts.models import User

STATUS_TRANSITIONS: dict[str, tuple[str, ...]] = {
    TicketStatus.OPEN: (
        TicketStatus.IN_PROGRESS,
        TicketStatus.WAITING_FOR_USER,
        TicketStatus.ANSWERED,
        TicketStatus.CLOSED,
    ),
    TicketStatus.IN_PROGRESS: (
        TicketStatus.WAITING_FOR_USER,
        TicketStatus.ANSWERED,
        TicketStatus.CLOSED,
        TicketStatus.OPEN,
    ),
    TicketStatus.WAITING_FOR_USER: (
        TicketStatus.IN_PROGRESS,
        TicketStatus.ANSWERED,
        TicketStatus.CLOSED,
        TicketStatus.OPEN,
    ),
    TicketStatus.ANSWERED: (
        TicketStatus.WAITING_FOR_USER,
        TicketStatus.IN_PROGRESS,
        TicketStatus.CLOSED,
        TicketStatus.OPEN,
    ),
    TicketStatus.CLOSED: (
        TicketStatus.OPEN,
        TicketStatus.IN_PROGRESS,
    ),
}


def hash_access_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def category_from_contact_subject(subject: str) -> str:
    return CONTACT_SUBJECT_TO_CATEGORY.get(subject, TicketCategory.OTHER)


def generate_ticket_number() -> str:
    stamp = timezone.now().strftime("%Y%m%d")
    return f"KF-{stamp}-{secrets.token_hex(3).upper()}"


def _excerpt(text: str) -> str:
    compact = " ".join(text.split())
    return compact[:177] + "…" if len(compact) > 180 else compact


def _full_clean_message(message: TicketMessage) -> None:
    try:
        message.full_clean()
    except DjangoValidationError as exc:
        raise ApiError("پیوست یا متن پیام معتبر نیست.") from exc


@transaction.atomic
def create_support_ticket(
    *,
    user: User | None,
    subject: str,
    message: str,
    category: str,
    priority: str = TicketPriority.NORMAL,
    contact_name: str = "",
    contact_email: str = "",
    contact_phone: str = "",
    source: str = TicketSource.PROFILE,
    attachment: UploadedFile | None = None,
) -> tuple[SupportTicket, str | None]:
    subject = subject.strip()
    body = message.strip()
    if len(subject) < 3:
        raise ApiError("موضوع باید حداقل ۳ نویسه باشد.")
    if len(body) < 10:
        raise ApiError("متن پیام باید حداقل ۱۰ نویسه باشد.")  # noqa: RUF001
    if category not in TicketCategory.values:
        raise ApiError("دسته‌بندی انتخاب‌شده معتبر نیست.")
    if priority not in TicketPriority.values:
        raise ApiError("اولویت انتخاب‌شده معتبر نیست.")

    name = contact_name.strip()
    email = contact_email.strip().lower()
    phone = contact_phone.strip()
    if user is not None:
        name = name or f"{user.first_name} {user.last_name}".strip() or user.email
        email = email or user.email
        phone = phone or (user.phone or "")
    if not name or not email:
        raise ApiError("نام و ایمیل برای ثبت درخواست الزامی است.")

    raw_token: str | None = None
    token_hash = ""
    if user is None:
        raw_token = secrets.token_urlsafe(32)
        token_hash = hash_access_token(raw_token)

    ticket = SupportTicket(
        ticket_number=generate_ticket_number(),
        user=user,
        subject=subject[:180],
        category=category,
        priority=priority,
        status=TicketStatus.OPEN,
        source=source,
        contact_name=name[:120],
        contact_email=email,
        contact_phone=phone[:24],
        access_token_hash=token_hash,
        last_message_at=timezone.now(),
        last_message_excerpt=_excerpt(body),
    )
    for _ in range(5):
        if not SupportTicket.objects.filter(ticket_number=ticket.ticket_number).exists():
            break
        ticket.ticket_number = generate_ticket_number()
    ticket.save()

    first = TicketMessage(
        ticket=ticket,
        sender=user,
        sender_type=SenderType.USER,
        message=body,
        is_internal=False,
    )
    if attachment is not None:
        first.attachment = attachment
    _full_clean_message(first)
    first.save()

    notify_ticket_created(ticket)
    return ticket, raw_token


def _touch_public_message(ticket: SupportTicket, text: str) -> None:
    now = timezone.now()
    ticket.last_message_at = now
    ticket.last_message_excerpt = _excerpt(text)
    ticket.save(
        update_fields=[
            "last_message_at",
            "last_message_excerpt",
            "updated_at",
            "status",
            "closed_at",
        ]
    )


@transaction.atomic
def add_user_message(
    *,
    ticket: SupportTicket,
    sender: User | None,
    message: str,
    attachment: UploadedFile | None = None,
) -> TicketMessage:
    if ticket.is_closed:
        raise ApiError("این تیکت بسته شده و امکان پاسخ وجود ندارد.")
    body = message.strip()
    if len(body) < 1 and attachment is None:
        raise ApiError("متن پاسخ را وارد کنید.")
    if body and len(body) < 2:
        raise ApiError("متن پاسخ خیلی کوتاه است.")
    item = TicketMessage(
        ticket=ticket,
        sender=sender,
        sender_type=SenderType.USER,
        message=body or "پیوست",
        is_internal=False,
    )
    if attachment is not None:
        item.attachment = attachment
    _full_clean_message(item)
    item.save()
    ticket.status = TicketStatus.IN_PROGRESS
    ticket.closed_at = None
    _touch_public_message(ticket, item.message)
    notify_user_replied(ticket)
    return item


@transaction.atomic
def add_staff_reply(
    *,
    ticket: SupportTicket,
    sender: User,
    message: str,
    attachment: UploadedFile | None = None,
) -> TicketMessage:
    body = message.strip()
    if len(body) < 1:
        raise ApiError("متن پاسخ پشتیبانی خالی است.")
    item = TicketMessage(
        ticket=ticket,
        sender=sender,
        sender_type=SenderType.STAFF,
        message=body,
        is_internal=False,
    )
    if attachment is not None:
        item.attachment = attachment
    _full_clean_message(item)
    item.save()
    if ticket.status != TicketStatus.CLOSED:
        ticket.status = TicketStatus.ANSWERED
        ticket.closed_at = None
    _touch_public_message(ticket, body)
    notify_staff_replied(ticket, item)
    return item


@transaction.atomic
def add_internal_note(*, ticket: SupportTicket, sender: User, message: str) -> TicketMessage:
    body = message.strip()
    if len(body) < 1:
        raise ApiError("یادداشت داخلی خالی است.")
    item = TicketMessage(
        ticket=ticket,
        sender=sender,
        sender_type=SenderType.STAFF,
        message=body,
        is_internal=True,
    )
    item.full_clean()
    item.save()
    ticket.save(update_fields=["updated_at"])
    return item


@transaction.atomic
def add_system_message(*, ticket: SupportTicket, message: str) -> TicketMessage:
    item = TicketMessage(
        ticket=ticket,
        sender=None,
        sender_type=SenderType.SYSTEM,
        message=message.strip(),
        is_internal=False,
    )
    item.save()
    _touch_public_message(ticket, item.message)
    return item


@transaction.atomic
def set_ticket_status(
    ticket: SupportTicket, status: str, *, actor: User | None = None
) -> SupportTicket:
    _ = actor
    if status not in TicketStatus.values:
        raise ApiError("وضعیت انتخاب‌شده معتبر نیست.")
    if status == ticket.status:
        return ticket
    ensure_transition(current=ticket.status, target=status, allowed=STATUS_TRANSITIONS)
    ticket.status = status
    if status == TicketStatus.CLOSED:
        ticket.closed_at = timezone.now()
        ticket.save(update_fields=["status", "closed_at", "updated_at"])
        add_system_message(ticket=ticket, message="تیکت بسته شد.")
    else:
        ticket.closed_at = None
        ticket.save(update_fields=["status", "closed_at", "updated_at"])
    return ticket


def close_ticket(ticket: SupportTicket, *, actor: User | None = None) -> SupportTicket:
    return set_ticket_status(ticket, TicketStatus.CLOSED, actor=actor)


def mark_ticket_read(ticket: SupportTicket) -> None:
    ticket.user_last_read_at = timezone.now()
    ticket.save(update_fields=["user_last_read_at"])


def ticket_has_unread(ticket: SupportTicket) -> bool:
    if ticket.last_message_at is None:
        return False
    last_staff = (
        ticket.messages.filter(sender_type=SenderType.STAFF, is_internal=False)
        .order_by("-created_at")
        .values_list("created_at", flat=True)
        .first()
    )
    if last_staff is None:
        return False
    if ticket.user_last_read_at is None:
        return True
    return last_staff > ticket.user_last_read_at


def public_messages(ticket: SupportTicket) -> QuerySet[TicketMessage]:
    return ticket.messages.filter(is_internal=False).select_related("sender")
