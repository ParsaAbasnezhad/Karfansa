"""The single versioned public API (``/api/v1/``).

Each app contributes a router here. Routers stay thin: business logic lives in
each app's ``services`` modules.
"""

from django.conf import settings
from ninja import NinjaAPI

from apps.accounts.api import router as accounts_router
from apps.contact.api import router as contact_router
from apps.core.api import router as core_router
from apps.core.errors import register_exception_handlers
from apps.geography.api import router as geography_router
from apps.home.api import router as home_router
from apps.market.api import router as market_router
from apps.organizations.business_api import router as business_router
from apps.services.api import router as services_router
from apps.support.api import router as support_router
from apps.trade.api import router as trade_router

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
api.add_router("/business", business_router, tags=["business accounts"])
api.add_router("/contact", contact_router, tags=["contact"])
api.add_router("/geography", geography_router, tags=["geography"])
api.add_router("/home", home_router, tags=["homepage"])
api.add_router("/market", market_router, tags=["market"])
api.add_router("/trade", trade_router, tags=["trade opportunities"])
api.add_router("/services", services_router, tags=["individual product marketplace"])
api.add_router("/support", support_router, tags=["support"])
