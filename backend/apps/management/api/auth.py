"""Password-only authentication for a separate, revocable console session.

MFA/TOTP endpoints remain registered for compatibility but always return 404.
"""

import hashlib
import hmac
import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.hashers import check_password
from django.core.cache import cache
from django.db import transaction
from django.http import HttpRequest
from django.middleware.csrf import get_token
from django.utils import timezone
from ninja import Router
from ninja.errors import HttpError

from apps.management.audit import audit_management, client_ip
from apps.management.models import AdminProfile, AdminSession
from apps.management.permissions import effective_action_codes, management_actor
from apps.management.schemas.auth import (
    AdminOut, CodeIn, ConfirmOut, CsrfOut, EnrollmentIn, MessageOut, PasswordLoginIn, ReauthIn,
    PasswordLoginOut, SetupOut,
)
from apps.management.totp import (
    authenticator_secret, consume_recovery_code, create_recovery_codes,
    matching_totp_step, provisioning_uri,
)


router = Router()
User = get_user_model()
PENDING_SECONDS = 300


def _rate_limit(request: HttpRequest, identifier: str, *, limit: int, seconds: int) -> None:
    """Fail closed if Redis is unavailable; never log the supplied identity."""
    material = f"{client_ip(request) or 'unknown'}:{identifier.casefold()}"
    digest = hmac.new(settings.SECRET_KEY.encode(), material.encode(), hashlib.sha256).hexdigest()
    key = f"management:auth:{digest}"
    try:
        cache.add(key, 0, timeout=seconds)
        count = cache.incr(key)
    except Exception as exc:
        raise HttpError(503, "Authentication temporarily unavailable") from exc
    if count > limit:
        audit_management(request, "auth.rate_limited", result="denied")
        raise HttpError(429, "Too many sign in attempts")


def _pending_profile(request: HttpRequest) -> AdminProfile:
    session = request.management_session  # type: ignore[attr-defined]
    user_id = session.get("pending_management_user_id")
    if not user_id:
        raise HttpError(401, "Sign in again")
    profile = AdminProfile.objects.select_related("user").filter(user_id=user_id).first()
    if profile is None or not profile.user.is_active or not profile.user.is_staff or profile.suspended:
        session.flush()
        raise HttpError(401, "Sign in again")
    return profile


def _require_mfa_enabled() -> None:
    # Password-only policy: MFA challenge endpoints are intentionally unavailable.
    raise HttpError(404, "Not found")


def _admin_output(user) -> AdminOut:  # type: ignore[no-untyped-def]
    codes = effective_action_codes(user)
    for permission in user.get_all_permissions():
        try:
            app, codename = permission.split(".", 1)
            verb, model = codename.split("_", 1)
        except ValueError:
            continue
        action = {"add": "create", "change": "update"}.get(verb, verb)
        if action in {"view", "create", "update", "delete"}:
            codes.add(f"{app}.{model}.{action}")
    name = f"{user.first_name} {user.last_name}".strip() or user.email
    return AdminOut(
        id=user.pk, email=user.email, name=name,
        is_superuser=user.is_superuser, permissions=sorted(codes),
        mfa_required=False,
    )


def _establish_session(request: HttpRequest, user: User) -> AdminOut:
    profile, _created = AdminProfile.objects.get_or_create(user=user)
    session = request.management_session  # type: ignore[attr-defined]
    session.flush()  # Rotate after the configured authentication policy succeeds.
    session["management_user_id"] = user.pk
    session["management_epoch"] = profile.session_epoch
    session.set_expiry(settings.MANAGEMENT_SESSION_TTL_SECONDS)
    session.save()
    now = timezone.now()
    AdminSession.objects.create(
        user=user,
        key_digest=hashlib.sha256(session.session_key.encode()).hexdigest(),
        expires_at=now + timedelta(seconds=settings.MANAGEMENT_SESSION_TTL_SECONDS),
        ip_address=client_ip(request),
        user_agent=request.META.get("HTTP_USER_AGENT", "")[:300],
    )
    request.management_actor = user  # type: ignore[attr-defined]
    audit_management(request, "auth.login")
    return _admin_output(user)


@router.get("/csrf", response=CsrfOut)
def csrf(request: HttpRequest) -> CsrfOut:
    return CsrfOut(csrf_token=get_token(request))


@router.post("/login", response=PasswordLoginOut)
def login(request: HttpRequest, payload: PasswordLoginIn) -> PasswordLoginOut:
    _rate_limit(request, payload.email, limit=8, seconds=900)
    _rate_limit(request, "ip", limit=40, seconds=900)
    user = authenticate(request, username=payload.email.strip().lower(), password=payload.password)
    if user is None or not user.is_active or not user.is_staff:
        audit_management(request, "auth.password", result="denied")
        raise HttpError(401, "Invalid credentials")
    profile, _created = AdminProfile.objects.get_or_create(user=user)
    if profile.suspended:
        audit_management(request, "auth.password", result="denied")
        raise HttpError(401, "Invalid credentials")
    # Invalidate any obsolete TOTP/recovery material on every successful password login.
    if (
        profile.mfa_seed or profile.enrollment_code_hash
        or profile.mfa_confirmed or profile.recovery_code_hashes
    ):
        profile.mfa_seed = ""
        profile.enrollment_code_hash = ""
        profile.mfa_confirmed = False
        profile.recovery_code_hashes = []
        profile.last_totp_step = -1
        profile.save(update_fields=[
            "mfa_seed", "enrollment_code_hash", "mfa_confirmed",
            "recovery_code_hashes", "last_totp_step", "updated_at",
        ])
    admin = _establish_session(request, user)
    audit_management(request, "auth.password_verified")
    return PasswordLoginOut(
        mfa_required=False, mfa_setup_required=False, admin=admin
    )


@router.post("/mfa/setup", response=SetupOut)
def mfa_setup(request: HttpRequest, payload: EnrollmentIn) -> SetupOut:
    _require_mfa_enabled()
    profile = _pending_profile(request)
    if profile.mfa_confirmed:
        raise HttpError(403, "Second factor already configured")
    _rate_limit(request, "mfa-enrollment", limit=8, seconds=900)
    if not profile.enrollment_code_hash or not check_password(
        payload.enrollment_code, profile.enrollment_code_hash
    ):
        audit_management(request, "auth.mfa_enrollment", result="denied")
        raise HttpError(401, "Invalid enrollment code")
    request.management_session["management_enrollment_authorized"] = True  # type: ignore[attr-defined]
    if not profile.mfa_seed:
        profile.mfa_seed = secrets.token_hex(32)
        profile.save(update_fields=["mfa_seed", "updated_at"])
    return SetupOut(
        secret=authenticator_secret(profile),
        provisioning_uri=provisioning_uri(profile),
    )


@router.post("/mfa/confirm", response=ConfirmOut)
def mfa_confirm(request: HttpRequest, payload: CodeIn) -> ConfirmOut:
    _require_mfa_enabled()
    _rate_limit(request, "mfa", limit=10, seconds=900)
    if not request.management_session.get("management_enrollment_authorized"):  # type: ignore[attr-defined]
        raise HttpError(403, "Enrollment authorization required")
    with transaction.atomic():
        profile = AdminProfile.objects.select_for_update().select_related("user").get(
            pk=_pending_profile(request).pk
        )
        if profile.mfa_confirmed or not profile.mfa_seed:
            raise HttpError(403, "Second factor unavailable")
        step = matching_totp_step(profile, payload.code)
        if step is None:
            audit_management(request, "auth.mfa_setup", result="denied")
            raise HttpError(401, "Invalid verification code")
        codes, hashes = create_recovery_codes()
        profile.last_totp_step = step
        profile.recovery_code_hashes = hashes
        profile.mfa_confirmed = True
        profile.enrollment_code_hash = ""
        profile.save(update_fields=["last_totp_step", "recovery_code_hashes", "mfa_confirmed", "enrollment_code_hash", "updated_at"])
    admin = _establish_session(request, profile.user)
    audit_management(request, "auth.mfa_enabled")
    return ConfirmOut(recovery_codes=codes, admin=admin)


@router.post("/verify", response=AdminOut)
def verify(request: HttpRequest, payload: CodeIn) -> AdminOut:
    _require_mfa_enabled()
    _rate_limit(request, "mfa", limit=10, seconds=900)
    with transaction.atomic():
        profile = AdminProfile.objects.select_for_update().select_related("user").get(
            pk=_pending_profile(request).pk
        )
        if not profile.mfa_confirmed:
            raise HttpError(403, "Second factor setup required")
        step = matching_totp_step(profile, payload.code)
        if step is not None:
            profile.last_totp_step = step
            profile.save(update_fields=["last_totp_step", "updated_at"])
        elif consume_recovery_code(profile, payload.code):
            profile.save(update_fields=["recovery_code_hashes", "updated_at"])
            audit_management(request, "auth.recovery_code_used")
        else:
            audit_management(request, "auth.mfa", result="denied")
            raise HttpError(401, "Invalid verification code")
    return _establish_session(request, profile.user)


@router.get("/me", response=AdminOut)
def me(request: HttpRequest) -> AdminOut:
    return _admin_output(management_actor(request))


@router.post("/reauth", response=MessageOut)
def reauthenticate(request: HttpRequest, payload: ReauthIn) -> MessageOut:
    user = management_actor(request)
    _rate_limit(request, "reauth", limit=8, seconds=900)
    verified = authenticate(request, username=user.email, password=payload.password)
    if verified is None or verified.pk != user.pk:
        audit_management(request, "auth.reauthenticate", result="denied")
        raise HttpError(401, "Invalid credentials")
    request.management_session["management_reauthenticated_at"] = int(timezone.now().timestamp())  # type: ignore[attr-defined]
    audit_management(request, "auth.reauthenticate")
    return MessageOut(message="Identity confirmed")


@router.post("/logout", response=MessageOut)
def logout(request: HttpRequest) -> MessageOut:
    user = management_actor(request)
    session = request.management_session  # type: ignore[attr-defined]
    AdminSession.objects.filter(
        key_digest=hashlib.sha256(session.session_key.encode()).hexdigest(), user=user
    ).update(revoked_at=timezone.now())
    audit_management(request, "auth.logout")
    session.flush()
    return MessageOut(message="Signed out")
