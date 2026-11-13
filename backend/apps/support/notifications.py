"""Email hooks for support events. Swap this module if a richer channel is added."""

import logging

from django.conf import settings
from django.core.mail import send_mail

from .models import SupportTicket, TicketMessage

logger = logging.getLogger(__name__)


def _inbox() -> str:
    return getattr(settings, "SUPPORT_INBOX_EMAIL", "") or settings.DEFAULT_FROM_EMAIL


def notify_ticket_created(ticket: SupportTicket) -> None:
    try:
        send_mail(
            subject=f"[Karfansa] تیکت جدید {ticket.ticket_number}",
            message=(
                f"تیکت {ticket.ticket_number} با موضوع «{ticket.subject}» ثبت شد.\n"
                f"از: {ticket.contact_name} <{ticket.contact_email}>\n"
                f"وضعیت: {ticket.get_status_display()}\n"
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[_inbox()],
            fail_silently=True,
        )
    except Exception:
        logger.exception("Failed to notify staff about ticket %s", ticket.ticket_number)


def notify_staff_replied(ticket: SupportTicket, message: TicketMessage) -> None:
    if not ticket.contact_email:
        return
    try:
        send_mail(
            subject=f"[Karfansa] پاسخ پشتیبانی {ticket.ticket_number}",
            message=(
                f"پاسخی برای تیکت {ticket.ticket_number} ثبت شد.\n"
                f"موضوع: {ticket.subject}\n\n"
                f"{message.message}\n"
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[ticket.contact_email],
            fail_silently=True,
        )
    except Exception:
        logger.exception("Failed to notify user about ticket %s", ticket.ticket_number)


def notify_user_replied(ticket: SupportTicket) -> None:
    try:
        send_mail(
            subject=f"[Karfansa] پاسخ کاربر {ticket.ticket_number}",
            message=(f"کاربر به تیکت {ticket.ticket_number} پاسخ داد.\nموضوع: {ticket.subject}\n"),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[_inbox()],
            fail_silently=True,
        )
    except Exception:
        logger.exception("Failed to notify staff about user reply on %s", ticket.ticket_number)
