"""Mobile OTP that shares the existing user model and session login.

Delivery uses the account email, an address the registrant just typed, and an
optional SMS webhook. Responses do not reveal whether a phone is registered.
"""

import hashlib
import logging
import re
import secrets

import requests
from django.conf import settings
from django.contrib.auth import password_validation
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.core.validators import validate_email
from django.db import IntegrityError, transaction

from apps.accounts.models import User
from apps.core.errors import ApiError

logger = logging.getLogger(__name__)

_PHONE_PATTERN = re.compile(r"\+?[0-9]{10,15}")
_INVALID = "کد واردشده معتبر نیست یا منقضی شده است."
_GENERIC_REGISTER = (
    "اگر اطلاعات معتبر باشد، حساب ساخته می‌شود. در غیر این صورت دوباره درخواست کد بدهید."
)


def normalize_phone(phone: str) -> str:
    compact = re.sub(r"[\s\-()]", "", phone.strip())
    if not _PHONE_PATTERN.fullmatch(compact):
        raise ApiError("شماره تلفن باید بین ۱۰ تا ۱۵ رقم باشد.")
    return compact


def _digest(phone: str) -> str:
    return hashlib.sha256(phone.encode()).hexdigest()


def _key(phone: str) -> str:
    return f"auth-phone-otp:{_digest(phone)}"


def _deliver(phone: str, code: str, hint_email: str) -> None:
    user = User.objects.filter(phone=phone, is_active=True).only("email").first()
    recipient = user.email if user else hint_email.strip().lower()
    if recipient:
        try:
            validate_email(recipient)
        except ValidationError:
            recipient = ""
    if recipient:
        send_mail(
            subject="کد تأیید کارفنسا",
            message=f"کد تأیید شما: {code}\nاین کد تا ۵ دقیقه معتبر است.",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[recipient],
            fail_silently=False,
        )
    webhook = settings.SMS_WEBHOOK_URL
    if not webhook:
        return
    try:
        requests.post(
            webhook,
            json={"to": phone, "text": f"کد تأیید کارفنسا: {code}"},
            timeout=5,
        )
    except requests.RequestException:
        logger.warning("Phone OTP webhook failed")


def request_phone_otp(phone: str, hint_email: str = "") -> None:
    phone = normalize_phone(phone)
    if hint_email.strip():
        try:
            validate_email(hint_email.strip().lower())
        except ValidationError as exc:
            raise ApiError("نشانی ایمیل معتبر نیست.") from exc
    digest = _digest(phone)
    if cache.get(f"auth-phone-throttle:{digest}"):
        raise ApiError("کمی صبر کنید و دوباره تلاش کنید.", status_code=429, code="rate_limited")
    hour_key = f"auth-phone-hour:{digest}"
    sent = int(cache.get(hour_key, 0))
    if sent >= 5:
        raise ApiError(
            "تعداد درخواست کد زیاد است. یک ساعت دیگر دوباره تلاش کنید.",
            status_code=429,
            code="rate_limited",
        )
    code = f"{secrets.randbelow(1_000_000):06d}"
    cache.set(_key(phone), {"code": code, "attempts": 0}, timeout=settings.OTP_TTL_SECONDS)
    cache.set(f"auth-phone-throttle:{digest}", True, timeout=60)
    cache.set(hour_key, sent + 1, timeout=3600)
    _deliver(phone, code, hint_email)


def _matching_challenge(phone: str, code: str) -> None:
    phone = normalize_phone(phone)
    payload = cache.get(_key(phone))
    submitted = code.strip()
    if not isinstance(payload, dict):
        raise ApiError(_INVALID, status_code=400, code="invalid_code")
    attempts = int(payload.get("attempts", 0))
    if attempts >= 5:
        cache.delete(_key(phone))
        raise ApiError(_INVALID, status_code=400, code="invalid_code")
    expected = str(payload.get("code", ""))
    if len(submitted) != len(expected) or not secrets.compare_digest(expected, submitted):
        payload["attempts"] = attempts + 1
        cache.set(_key(phone), payload, timeout=settings.OTP_TTL_SECONDS)
        raise ApiError(_INVALID, status_code=400, code="invalid_code")


def _consume(phone: str) -> None:
    cache.delete(_key(normalize_phone(phone)))


def login_with_phone(phone: str, code: str) -> User:
    phone = normalize_phone(phone)
    _matching_challenge(phone, code)
    user = User.objects.filter(phone=phone, is_active=True).first()
    _consume(phone)
    if user is None:
        raise ApiError(_INVALID, status_code=400, code="invalid_code")
    return user


def register_with_phone(
    *,
    phone: str,
    code: str,
    email: str,
    password: str,
    first_name: str,
    last_name: str,
) -> User:
    phone = normalize_phone(phone)
    email = email.strip().lower()
    first_name = first_name.strip()
    last_name = last_name.strip()
    if not first_name or not last_name:
        raise ApiError("نام و نام خانوادگی را وارد کنید.")
    try:
        validate_email(email)
    except ValidationError as exc:
        raise ApiError("نشانی ایمیل معتبر نیست.") from exc
    candidate = User(email=email, phone=phone, first_name=first_name, last_name=last_name)
    try:
        password_validation.validate_password(password, user=candidate)
    except ValidationError as exc:
        raise ApiError("گذرواژه ضعیف است: " + " ".join(exc.messages)) from exc
    _matching_challenge(phone, code)
    phone_taken = User.objects.filter(phone=phone).exists()
    email_taken = User.objects.filter(email__iexact=email).exists()
    if phone_taken or email_taken:
        _consume(phone)
        raise ApiError(_GENERIC_REGISTER, status_code=400, code="registration_unavailable")
    try:
        with transaction.atomic():
            user = User.objects.create_user(
                email=email,
                phone=phone,
                password=password,
                first_name=first_name,
                last_name=last_name,
            )
    except IntegrityError as exc:
        _consume(phone)
        raise ApiError(_GENERIC_REGISTER, status_code=400, code="registration_unavailable") from exc
    _consume(phone)
    return user
