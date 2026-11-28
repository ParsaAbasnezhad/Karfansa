"""Settings shared by every environment. Environment-specific files import from here."""

from pathlib import Path

import environ
from django.templatetags.static import static

env = environ.Env()

BASE_DIR = Path(__file__).resolve().parents[2]

# --- Core -----------------------------------------------------------------------------------
SECRET_KEY: str = env("DJANGO_SECRET_KEY")
DEBUG = False
ALLOWED_HOSTS: list[str] = env.list("DJANGO_ALLOWED_HOSTS", default=[])
APP_VERSION: str = env("APP_VERSION", default="0.1.0")
API_DOCS_ENABLED = False

INSTALLED_APPS = [
    # Django
    "unfold",
    "unfold.contrib.filters",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    # Third Party
    "ninja",

    # Internal Apps
    "apps.accounts",
    "apps.contact",
    "apps.home",
    "apps.core",
    "apps.intents",
    "apps.analysis",
    "apps.advertising",
    "apps.geography",
    # Keep legacy models registered so existing news tables and migration history remain intact.
    "apps.news",
    "apps.management.apps.ManagementConfig",
    "apps.organization_news",
    "apps.organizations",
    "apps.trade",
    "apps.services",
    "apps.support",
    "apps.transportation",
]

# Unfold supports Django 5.2 and keeps the existing Django admin site and auth.
UNFOLD = {
    "SITE_TITLE": "مدیریت کارفنسا",
    "SITE_HEADER": "کارفنسا",
    "SITE_SUBHEADER": "پنل مدیریت",
    "SITE_URL": "/",
    "SITE_SYMBOL": "dashboard",
    "SITE_ICON": lambda request: static("core/admin/brand-mark.svg"),
    "SHOW_VIEW_ON_SITE": False,
    "SHOW_HISTORY": True,
    "THEME": "dark",
    "BORDER_RADIUS": "10px",
    "DASHBOARD_CALLBACK": "apps.core.admin_dashboard.dashboard_callback",
    "STYLES": [lambda request: static("core/admin/karfansa-admin.css")],
    "SCRIPTS": [lambda request: static("core/admin/karfansa-admin.js")],
    "COLORS": {
        "primary": {
            "50": "#edf9f3",
            "100": "#d7f2e3",
            "200": "#b2e5cb",
            "300": "#7bd2a8",
            "400": "#42b982",
            "500": "#209a68",
            "600": "#147c53",
            "700": "#126345",
            "800": "#124f39",
            "900": "#104130",
            "950": "#08251b",
        },
    },
    "SIDEBAR": {
        "show_search": True,
        "show_all_applications": True,
    },
}

AUTH_USER_MODEL = "accounts.User"
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 12}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]
AUTHENTICATION_BACKENDS = ["django.contrib.auth.backends.ModelBackend"]
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.Argon2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "apps.management.middleware.ManagementSecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# --- Database / cache -----------------------------------------------------------------------
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": env("POSTGRES_DB"),
        "USER": env("POSTGRES_USER"),
        "PASSWORD": env("POSTGRES_PASSWORD"),
        "HOST": env("POSTGRES_HOST", default="localhost"),
        "PORT": env("POSTGRES_PORT", default="5432"),
        "CONN_MAX_AGE": 60,
        "CONN_HEALTH_CHECKS": True,
    }
}
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
CSRF_USE_SESSIONS = False
CSRF_COOKIE_HTTPONLY = False
MANAGEMENT_ALLOWED_HOSTS = env.list("MANAGEMENT_ALLOWED_HOSTS", default=["console.karfansa.ir"])
MANAGEMENT_TRUSTED_PROXY_IPS = env.list("MANAGEMENT_TRUSTED_PROXY_IPS", default=[])
# Control Center authentication is email + password only in every environment.
# The setting is retained for schema/API compatibility but is never enabled.
MANAGEMENT_MFA_REQUIRED = False
MANAGEMENT_SESSION_COOKIE_NAME = "karfansa_console_session"
MANAGEMENT_SESSION_TTL_SECONDS = env.int("MANAGEMENT_SESSION_TTL_SECONDS", default=8 * 3600)
MANAGEMENT_INACTIVITY_SECONDS = env.int("MANAGEMENT_INACTIVITY_SECONDS", default=30 * 60)
EMAIL_BACKEND = env("EMAIL_BACKEND", default="django.core.mail.backends.console.EmailBackend")
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="noreply@karfansa.ir")
SUPPORT_INBOX_EMAIL = env("SUPPORT_INBOX_EMAIL", default=DEFAULT_FROM_EMAIL)
OTP_TTL_SECONDS = env.int("OTP_TTL_SECONDS", default=300)
INTENT_TRUSTED_PROXY_IPS = env.list("INTENT_TRUSTED_PROXY_IPS", default=[])

# Redis base URL without a database number. db 0: Celery broker, 1: cache, 2: Celery results.
REDIS_URL: str = env("REDIS_URL", default="redis://localhost:6379").rstrip("/")

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": f"{REDIS_URL}/1",
        "KEY_PREFIX": "karfansa",
    }
}

# --- i18n -----------------------------------------------------------------------------------
LANGUAGE_CODE = "fa"
TIME_ZONE = "UTC"  # Stored in UTC. Jalali/Tehran display is done in the frontend.
USE_I18N = True
USE_TZ = True

# --- Static ---------------------------------------------------------------------------------
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"
PRIVATE_MEDIA_ROOT = BASE_DIR / "private_media"
SMS_WEBHOOK_URL = env("SMS_WEBHOOK_URL", default="")

# --- Celery ---------------------------------------------------------------------------------
CELERY_BROKER_URL = f"{REDIS_URL}/0"
CELERY_RESULT_BACKEND = f"{REDIS_URL}/2"
CELERY_RESULT_EXPIRES = 3600
CELERY_TIMEZONE = "UTC"
CELERY_TASK_DEFAULT_QUEUE = "default"
CELERY_TASK_ACKS_LATE = True
CELERY_TASK_REJECT_ON_WORKER_LOST = True
CELERY_WORKER_PREFETCH_MULTIPLIER = 1
CELERY_TASK_SOFT_TIME_LIMIT = 240
CELERY_TASK_TIME_LIMIT = 300
CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP = True
CELERY_BEAT_SCHEDULE = {
    "management-beat-heartbeat": {
        "task": "apps.management.tasks.beat_heartbeat",
        "schedule": 60.0,
    },
}

# --- Logging --------------------------------------------------------------------------------
LOG_LEVEL: str = env("DJANGO_LOG_LEVEL", default="INFO")
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "standard": {"format": "%(asctime)s %(levelname)s %(name)s: %(message)s"},
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "standard"},
    },
    "root": {"handlers": ["console"], "level": LOG_LEVEL},
}
