"""The single versioned public API (``/api/v1/``).

Each app contributes a router here. Routers stay thin: business logic lives in
each app's ``services`` modules.
"""

from django.conf import settings
from ninja import NinjaAPI

from apps.accounts.api import router as accounts_router
from apps.core.api import router as core_router
from apps.core.errors import register_exception_handlers

api = NinjaAPI(
    title="Karfansa API",
    version="1.0.0",
    urls_namespace="api-v1",
    docs_url="/docs" if settings.API_DOCS_ENABLED else None,
    openapi_url="/openapi.json" if settings.API_DOCS_ENABLED else None,
)

register_exception_handlers(api)

api.add_router("/health", core_router, tags=["system"])
api.add_router("/auth", accounts_router, tags=["authentication"])
