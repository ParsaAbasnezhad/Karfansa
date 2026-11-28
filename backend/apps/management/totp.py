"""RFC 6238 TOTP using the standard library; the database stores only a seed.

The authenticator secret is derived from the seed and Django's SECRET_KEY, so a
database dump alone does not reveal usable TOTP credentials.
"""

import base64
import hashlib
import hmac
import secrets
import struct
import time
from urllib.parse import quote

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password

from apps.accounts.models import User

from .models import AdminProfile


def _secret_for(profile: AdminProfile, server_key: str) -> bytes:
    material = bytes.fromhex(profile.mfa_seed) + str(profile.user_id).encode()
    return hmac.new(server_key.encode(), material, hashlib.sha256).digest()[:20]


def authenticator_secret(profile: AdminProfile) -> str:
    return base64.b32encode(_secret_for(profile, settings.SECRET_KEY)).decode().rstrip("=")


def provisioning_uri(profile: AdminProfile) -> str:
    user = User.objects.only("email").get(pk=profile.user_id)
    label = quote(f"Karfansa Control Center:{user.email}")
    return (
        f"otpauth://totp/{label}?secret={authenticator_secret(profile)}"
        "&issuer=Karfansa%20Control%20Center&algorithm=SHA1&digits=6&period=30"
    )


def create_recovery_codes(count: int = 10) -> tuple[list[str], list[str]]:
    codes = [secrets.token_hex(10).upper() for _ in range(count)]
    return codes, [make_password(code) for code in codes]


def _totp(secret: bytes, step: int) -> str:
    digest = hmac.new(secret, struct.pack(">Q", step), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    value = struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF
    return f"{value % 1_000_000:06d}"


def matching_totp_step(profile: AdminProfile, code: str, *, now: float | None = None) -> int | None:
    code = code.strip()
    if len(code) != 6 or not code.isascii() or not code.isdecimal() or not profile.mfa_seed:
        return None
    current = int((time.time() if now is None else now) // 30)
    for server_key in [settings.SECRET_KEY, *getattr(settings, "SECRET_KEY_FALLBACKS", [])]:
        secret = _secret_for(profile, server_key)
        for step in (current - 1, current, current + 1):
            if step > profile.last_totp_step and hmac.compare_digest(_totp(secret, step), code):
                return step
    return None


def consume_recovery_code(profile: AdminProfile, code: str) -> bool:
    normalized = code.strip().upper().replace("-", "")
    if len(normalized) != 20 or any(char not in "0123456789ABCDEF" for char in normalized):
        return False
    hashes = list(profile.recovery_code_hashes)
    for index, hashed in enumerate(hashes):
        if check_password(normalized, hashed):
            hashes.pop(index)
            profile.recovery_code_hashes = hashes
            return True
    return False
