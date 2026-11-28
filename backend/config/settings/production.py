from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F403
from .base import ALLOWED_HOSTS, SECRET_KEY, env

DEBUG = False

# Management login is password-only. Ignore any leftover MANAGEMENT_MFA_REQUIRED env.
MANAGEMENT_MFA_REQUIRED = False

if len(SECRET_KEY) < 50 or SECRET_KEY.startswith(("dev-only", "test-only", "change-me")):
    raise ImproperlyConfigured("DJANGO_SECRET_KEY must be a long, random, production-only value.")
if not ALLOWED_HOSTS:
    raise ImproperlyConfigured("DJANGO_ALLOWED_HOSTS must list the production host names.")

# --- HTTPS and cookies ----------------------------------------------------------------------
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = env.bool("DJANGO_SECURE_SSL_REDIRECT", default=True)
# Container health checks call the app over plain HTTP; they must not be redirected.
SECURE_REDIRECT_EXEMPT = [r"^api/v1/health/"]
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_SECURE = True
CSRF_TRUSTED_ORIGINS = env.list("DJANGO_CSRF_TRUSTED_ORIGINS", default=[])

# Start low and raise via env once HTTPS is verified end to end.
SECURE_HSTS_SECONDS = env.int("DJANGO_SECURE_HSTS_SECONDS", default=3600)
SECURE_HSTS_INCLUDE_SUBDOMAINS = env.bool("DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS", default=False)
SECURE_HSTS_PRELOAD = env.bool("DJANGO_SECURE_HSTS_PRELOAD", default=False)
# Subdomain/preload are deliberate, irreversible-ish choices made at launch, not defaults.
SILENCED_SYSTEM_CHECKS = ["security.W005", "security.W021"]
