import re
import secrets

from django.conf import settings
from django.contrib.auth import authenticate, password_validation
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.core.validators import validate_email
from django.db import IntegrityError, transaction

from apps.accounts.models import User
from apps.core.errors import ApiError


def register_user(*, email: str, phone: str, password: str) -> User:
    email = email.strip().lower()
    phone = phone.strip()
    if not all((email, phone, password)):
        raise ApiError("ایمیل، تلفن و گذرواژه الزامی هستند.")
    try:
        validate_email(email)
    except ValidationError as exc:
        raise ApiError("نشانی ایمیل معتبر نیست.") from exc
    if not re.fullmatch(r"\+?[0-9]{10,15}", phone):
        raise ApiError("شماره تلفن باید بین ۱۰ تا ۱۵ رقم باشد.")
    if User.objects.filter(email__iexact=email).exists():
        raise ApiError("این ایمیل قبلاً ثبت شده است.", status_code=409, code="email_exists")
    if User.objects.filter(phone=phone).exists():
        raise ApiError("این شمارهٔ تلفن قبلاً ثبت شده است.", status_code=409, code="phone_exists")
    candidate = User(email=email, phone=phone)
    try:
        password_validation.validate_password(password, user=candidate)
    except ValidationError as exc:
        raise ApiError("گذرواژه ضعیف است: " + " ".join(exc.messages)) from exc
    try:
        with transaction.atomic():
            return User.objects.create_user(email=email, phone=phone, password=password)
    except IntegrityError as exc:
        if User.objects.filter(email__iexact=email).exists():
            raise ApiError(
                "این ایمیل قبلاً ثبت شده است.", status_code=409, code="email_exists"
            ) from exc
        if User.objects.filter(phone=phone).exists():
            raise ApiError(
                "این شمارهٔ تلفن قبلاً ثبت شده است.", status_code=409, code="phone_exists"
            ) from exc
        raise


def password_login(email: str, password: str) -> User:
    throttle_key = f"auth-password-throttle:{email.strip().lower()}"
    attempts = cache.get(throttle_key, 0)
    if attempts >= 5:
        raise ApiError("تعداد تلاش‌ها زیاد است. ۱۵ دقیقهٔ دیگر دوباره تلاش کنید.", status_code=429, code="rate_limited")
    user = authenticate(username=email.strip().lower(), password=password)
    if user is None:
        cache.set(throttle_key, attempts + 1, timeout=900)
        raise ApiError("ایمیل یا گذرواژه نادرست است.", status_code=401, code="invalid_credentials")
    cache.delete(throttle_key)
    return user


def send_password_reset(email: str) -> None:
    email = email.strip().lower()
    user = User.objects.filter(email__iexact=email, is_active=True).first()
    if user is None:
        return
    key = f"auth-password-reset-throttle:{email}"
    if cache.get(key):
        raise ApiError("کمی صبر کنید و دوباره تلاش کنید.", status_code=429, code="rate_limited")
    code = f"{secrets.randbelow(1_000_000):06d}"
    cache.set(f"auth-password-reset:{email}", code, timeout=600)
    cache.set(key, True, timeout=60)
    send_mail(
        subject="بازیابی گذرواژهٔ کارفنسا",
        message=f"کد بازیابی گذرواژه شما: {code}\nاین کد تا ۱۰ دقیقه معتبر است.",
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=False,
    )


def reset_password(email: str, code: str, password: str) -> User:
    email = email.strip().lower()
    key = f"auth-password-reset:{email}"
    expected = cache.get(key)
    if not expected or not secrets.compare_digest(str(expected), code.strip()):
        raise ApiError("کد بازیابی معتبر نیست یا منقضی شده است.", status_code=400, code="invalid_code")
    user = User.objects.filter(email__iexact=email, is_active=True).first()
    if user is None:
        raise ApiError("کد بازیابی معتبر نیست یا منقضی شده است.", status_code=400, code="invalid_code")
    try:
        password_validation.validate_password(password, user=user)
    except ValidationError as exc:
        raise ApiError("گذرواژه ضعیف است: " + " ".join(exc.messages)) from exc
    user.set_password(password)
    user.save(update_fields=["password"])
    cache.delete(key)
    cache.delete(f"auth-password-throttle:{email}")
    return user


def send_login_code(email: str) -> None:
    email = email.strip().lower()
    user = User.objects.filter(email__iexact=email, is_active=True).first()
    if user is None:
        # Keep the response indistinguishable for existing and unknown email addresses.
        return
    throttle_key = f"auth-otp-throttle:{email}"
    if cache.get(throttle_key):
        raise ApiError("کمی صبر کنید و دوباره تلاش کنید.", status_code=429, code="rate_limited")
    code = f"{secrets.randbelow(1_000_000):06d}"
    cache.set(f"auth-otp:{email}", code, timeout=settings.OTP_TTL_SECONDS)
    cache.set(throttle_key, True, timeout=60)
    send_mail(
        subject="کد ورود کارفنسا",
        message=f"کد یک‌بارمصرف ورود شما: {code}\nاین کد تا ۵ دقیقه معتبر است.",
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=False,
    )


def verify_login_code(email: str, code: str) -> User:
    email = email.strip().lower()
    key = f"auth-otp:{email}"
    expected = cache.get(key)
    if not expected or not secrets.compare_digest(str(expected), code.strip()):
        raise ApiError("کد واردشده معتبر نیست یا منقضی شده است.", status_code=400, code="invalid_code")
    cache.delete(key)
    user = User.objects.filter(email__iexact=email, is_active=True).first()
    if user is None:
        raise ApiError("کد واردشده معتبر نیست یا منقضی شده است.", status_code=400, code="invalid_code")
    return user
