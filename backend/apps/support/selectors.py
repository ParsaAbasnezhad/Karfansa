from datetime import datetime
from math import ceil

from django.db.models import F, OuterRef, Q, QuerySet, Subquery

from .models import SenderType, SupportTicket, TicketMessage, TicketStatus
from .schemas import TicketSummaryOut
from .services import ticket_has_unread


def tickets_for_user(user_id: int) -> QuerySet[SupportTicket]:
    last_staff = (
        TicketMessage.objects.filter(
            ticket_id=OuterRef("pk"),
            sender_type=SenderType.STAFF,
            is_internal=False,
        )
        .order_by("-created_at")
        .values("created_at")[:1]
    )
    return SupportTicket.objects.filter(user_id=user_id).annotate(
        last_staff_at=Subquery(last_staff)
    )


def apply_ticket_filters(
    queryset: QuerySet[SupportTicket],
    *,
    query: str = "",
    status: str = "",
) -> QuerySet[SupportTicket]:
    if status:
        queryset = queryset.filter(status=status)
    needle = query.strip()
    if needle:
        queryset = queryset.filter(
            Q(ticket_number__icontains=needle)
            | Q(subject__icontains=needle)
            | Q(last_message_excerpt__icontains=needle)
        )
    return queryset


def summarize_tickets(queryset: QuerySet[SupportTicket]) -> TicketSummaryOut:
    total = queryset.count()
    open_count = queryset.exclude(status=TicketStatus.CLOSED).count()
    waiting = queryset.filter(
        status__in=[TicketStatus.WAITING_FOR_USER, TicketStatus.ANSWERED]
    ).count()
    answered = queryset.filter(status=TicketStatus.ANSWERED).count()
    unread = (
        queryset.filter(last_staff_at__isnull=False)  # type: ignore[misc]
        .filter(Q(user_last_read_at__isnull=True) | Q(last_staff_at__gt=F("user_last_read_at")))
        .count()
    )
    return TicketSummaryOut(
        total=total,
        open=open_count,
        waiting_for_user=waiting,
        answered=answered,
        unread=unread,
    )


def paginate(
    queryset: QuerySet[SupportTicket], *, page: int, page_size: int
) -> tuple[list[SupportTicket], int, int]:
    count = queryset.count()
    total_pages = ceil(count / page_size) if count else 0
    start = (page - 1) * page_size
    return list(queryset[start : start + page_size]), count, total_pages


def has_unread(ticket: SupportTicket) -> bool:
    last_staff_at: datetime | None = getattr(ticket, "last_staff_at", None)
    if last_staff_at is None:
        return ticket_has_unread(ticket)
    if ticket.user_last_read_at is None:
        return True
    return last_staff_at > ticket.user_last_read_at
