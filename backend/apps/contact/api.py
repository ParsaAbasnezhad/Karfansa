import hashlib

from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.http import HttpRequest
from django.views.decorators.csrf import csrf_protect
from ninja import Router, Status
from ninja.decorators import decorate_view

from apps.core.errors import ApiError

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
            "تعداد پیام‌ها زیاد است. کمی بعد دوباره تلاش کنید.", status_code=429  # noqa: RUF001
        )

    ContactMessage.objects.create(
        name=payload.name.strip(),
        phone=payload.phone,
        email=payload.email.strip().lower(),
        subject=payload.subject.strip(),
        message=payload.message.strip(),
    )
    return Status(201, ContactMessageOut(message="پیام شما با موفقیت ثبت شد."))
