from .base import *  # noqa: F403

DEBUG = True
ALLOWED_HOSTS = ["localhost", "127.0.0.1", "[::1]", "backend"]
MANAGEMENT_ALLOWED_HOSTS = ["localhost", "127.0.0.1", "backend"]
MANAGEMENT_MFA_REQUIRED = False
API_DOCS_ENABLED = True

# The browser talks to the Vite dev server, which proxies /api to Django (same origin).
CSRF_TRUSTED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
]
