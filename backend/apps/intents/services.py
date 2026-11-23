"""Validated intent writes and guest-to-account reconciliation."""

import hashlib

# Persian API messages are intentional.
# ruff: noqa: RUF001
import hmac
import ipaddress
import re
from uuid import UUID

from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from django.utils import timezone
from redis.exceptions import RedisError

from apps.accounts.models import User
from apps.core.errors import ApiError
from apps.intents.models import FollowUpStatus, IntentGoal, UserIntent

CONSENT_TEXT_VERSION = "follow-up-v1-2026-11"
_MOBILE = re.compile(r"09[0-9]{9}\Z")
_DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")


def validate_goals(goals: list[str], *, allow_empty: bool = False) -> list[str]:
    allowed = set(IntentGoal.values)
    if (
        (not goals and not allow_empty)
        or len(goals) > len(allowed)
        or len(goals) != len(set(goals))
        or any(goal not in allowed for goal in goals)
        or (IntentGoal.EXPLORING in goals and len(goals) > 1)
    ):
        raise ApiError(
            "حداقل یک هدف معتبر انتخاب کنید. گزینه آشنایی با سایر اهداف قابل ترکیب نیست."
        )
    return goals


def normalize_mobile(phone: str) -> str:
    if len(phone) > 32:
        raise ApiError("شماره موبایل ایرانی معتبر نیست. نمونه: 09123456789")
    compact = re.sub(r"[\s\-()]", "", phone.translate(_DIGITS))
    if not compact:
        return ""
    if compact.startswith("+98"):
        compact = "0" + compact[3:]
    elif compact.startswith("0098"):
        compact = "0" + compact[4:]
    if not _MOBILE.fullmatch(compact):
        raise ApiError("شماره موبایل ایرانی معتبر نیست. نمونه: 09123456789")
    return compact


def validate_contact(phone: str, consent: bool) -> str:
    normalized = normalize_mobile(phone)
    if consent and not normalized:
        raise ApiError("برای درخواست تماس، شماره موبایل خود را وارد کنید.")
    return normalized


def token_hash(token: UUID) -> str:
    if token.version != 4:
        raise ApiError("شناسه درخواست معتبر نیست.")
    return hmac.new(settings.SECRET_KEY.encode(), token.bytes, hashlib.sha256).hexdigest()


def _client_address(request: object) -> str:
    raw = getattr(request, "META", {}).get("REMOTE_ADDR", "")
    try:
        address = str(ipaddress.ip_address(raw))
    except ValueError:
        return "unknown"
    if address in settings.INTENT_TRUSTED_PROXY_IPS:
        forwarded = getattr(request, "META", {}).get("HTTP_X_FORWARDED_FOR", "")
        first = forwarded.split(",", 1)[0].strip()
        try:
            return str(ipaddress.ip_address(first))
        except ValueError:
            return "unknown"
    return address


def throttle_guest(request: object) -> None:
    address = _client_address(request)
    digest = hashlib.sha256(address.encode()).hexdigest()[:24]
    key = f"intent-guest-hour:{digest}"
    try:
        cache.add(key, 0, timeout=3600)
        attempts = cache.incr(key)
    except RedisError as exc:
        raise ApiError(
            "ثبت موقتاً در دسترس نیست. کمی بعد دوباره تلاش کنید.", status_code=503
        ) from exc
    if attempts > 10:
        raise ApiError("تعداد درخواست‌ها زیاد است. کمی بعد دوباره تلاش کنید.", status_code=429)


@transaction.atomic
def create_guest_intent(*, token: UUID, goals: list[str], phone: str, consent: bool) -> UserIntent:
    goals = validate_goals(goals)
    phone = validate_contact(phone, consent)
    digest = token_hash(token)
    now = timezone.now()
    record, created = UserIntent.objects.get_or_create(
        guest_token_hash=digest,
        defaults={
            "goals": goals,
            "contact_phone": phone,
            "contact_consent": consent,
            "consent_at": now if consent else None,
            "consent_text_version": CONSENT_TEXT_VERSION if consent else "",
            "follow_up_status": FollowUpStatus.NEW if consent else FollowUpStatus.NOT_NEEDED,
        },
    )
    if not created:
        if (
            record.merged_into_id
            or record.user_id
            or record.goals != goals
            or record.contact_phone != phone
            or record.contact_consent != consent
        ):
            raise ApiError("این ثبت قبلاً انجام شده است.", status_code=409)
        return record
    record.full_clean()
    return record


@transaction.atomic
def create_user_intent(*, user: User, goals: list[str], phone: str, consent: bool) -> UserIntent:
    goals = validate_goals(goals)
    phone = validate_contact(phone, consent)
    record, created = UserIntent.objects.get_or_create(
        user=user,
        defaults={
            "goals": goals,
            "contact_phone": phone,
            "contact_consent": consent,
            "consent_at": timezone.now() if consent else None,
            "consent_text_version": CONSENT_TEXT_VERSION if consent else "",
            "follow_up_status": FollowUpStatus.NEW if consent else FollowUpStatus.NOT_NEEDED,
        },
    )
    if not created:
        raise ApiError("هدف شما قبلاً ثبت شده است. آن را از پروفایل ویرایش کنید.", status_code=409)
    record.full_clean()
    return record


@transaction.atomic
def update_user_goals(*, user: User, goals: list[str]) -> UserIntent:
    goals = validate_goals(goals, allow_empty=True)
    record = UserIntent.objects.select_for_update().filter(user=user).first()
    if record is None:
        record = UserIntent(user=user, goals=goals)
    else:
        record.goals = goals
    record.full_clean()
    record.save()
    return record


@transaction.atomic
def remove_user_contact(user: User) -> UserIntent | None:
    record = UserIntent.objects.select_for_update().filter(user=user).first()
    if record is None:
        return None
    record.contact_phone = ""
    record.contact_consent = False
    # Historical consent time/version remain for an audit of the earlier choice.
    record.full_clean()
    record.save()
    return record


def _combine_goals(current: list[str], incoming: list[str]) -> list[str]:
    combined = list(dict.fromkeys([*current, *incoming]))
    if len(combined) > 1 and IntentGoal.EXPLORING in combined:
        combined.remove(IntentGoal.EXPLORING)
    return combined


@transaction.atomic
def claim_guest_intent(user: User, token: UUID | str | None) -> bool:
    if not token:
        return False
    try:
        parsed = UUID(str(token))
    except ValueError:
        return False
    if parsed.version != 4:
        return False
    guest = (
        UserIntent.objects.select_for_update().filter(guest_token_hash=token_hash(parsed)).first()
    )
    if guest is None or guest.user_id or guest.merged_into_id:
        return False
    account = UserIntent.objects.select_for_update().filter(user=user).first()
    if account is None:
        guest.user = user
        guest.guest_token_hash = None
        guest.full_clean()
        guest.save()
        return True
    account.goals = _combine_goals(account.goals, guest.goals)
    if not account.contact_phone:
        account.contact_phone = guest.contact_phone
        # Existing account consent is intentionally never changed by a merge.
    account.full_clean()
    account.save()
    guest.guest_token_hash = None
    guest.contact_phone = ""
    guest.merged_into = user
    guest.full_clean()
    guest.save()
    return True
