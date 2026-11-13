import hashlib

from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import transaction
from django.http import HttpRequest
from django.views.decorators.csrf import csrf_protect
from ninja import Router, Status
from ninja.decorators import decorate_view

from apps.core.errors import ApiError
from apps.support.models import TicketSource
from apps.support.services import category_from_contact_subject, create_support_ticket

from .models import ContactMessage
from .schemas import ContactMessageIn, ContactMessageOut

router = Router()


@router.post("/", response={201: ContactMessageOut}, operation_id="contact_message_create")
@decorate_view(csrf_protect)
def create_contact_message(
    request: HttpRequest,
    payload: ContactMessageIn,
) -> Status[ContactMessageOut]:
    if payload.website.strip():
        raise ApiError("درخواست معتبر نیست.")
    try:
        validate_email(payload.email.strip())
    except ValidationError as exc:
        raise ApiError("نشانی ایمیل معتبر نیست.") from exc

    remote_addr = request.META.get("REMOTE_ADDR", "unknown")
    throttle_id = hashlib.sha256(remote_addr.encode()).hexdigest()
    throttle_key = f"contact-message:{throttle_id}"
    cache.add(throttle_key, 0, timeout=3600)
    attempts = cache.incr(throttle_key)
    if attempts > 5:
        raise ApiError(
            "تعداد پیام‌ها زیاد است. کمی بعد دوباره تلاش کنید.",  # noqa: RUF001
            status_code=429,
        )

    user = request.user if request.user.is_authenticated else None
    with transaction.atomic():
        ticket, access_token = create_support_ticket(
            user=user,
            subject=payload.subject.strip(),
            message=payload.message.strip(),
            category=category_from_contact_subject(payload.subject.strip()),
            contact_name=payload.name.strip(),
            contact_email=payload.email.strip().lower(),
            contact_phone=payload.phone,
            source=TicketSource.CONTACT,
        )
        ContactMessage.objects.create(
            name=payload.name.strip(),
            phone=payload.phone,
            email=payload.email.strip().lower(),
            subject=payload.subject.strip(),
            message=payload.message.strip(),
        )
    return Status(
        201,
        ContactMessageOut(
            message="پیام شما با موفقیت ثبت شد.",
            ticket_number=ticket.ticket_number,
            access_token=access_token,
        ),
    )
