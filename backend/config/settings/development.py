from .base import *  # noqa: F403

DEBUG = True
ALLOWED_HOSTS = ["localhost", "127.0.0.1", "[::1]", "backend"]
API_DOCS_ENABLED = True

# The browser talks to the Vite dev server, which proxies /api to Django (same origin).
CSRF_TRUSTED_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]
