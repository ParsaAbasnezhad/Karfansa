"""The single versioned public API (``/api/v1/``).

Each app contributes a router here. Routers stay thin: business logic lives in
each app's ``services`` modules.
"""

from django.conf import settings
from ninja import NinjaAPI

from apps.advertising.api import router as advertising_router
from apps.accounts.api import router as accounts_router
from apps.analysis.api import router as analysis_router
from apps.contact.api import router as contact_router
from apps.core.api import router as core_router
from apps.core.errors import register_exception_handlers
from apps.geography.api import router as geography_router
from apps.home.api import router as home_router
from apps.intents.api import router as intents_router
from apps.management.api.auth import router as management_auth_router
from apps.management.api.dashboard import router as management_dashboard_router
from apps.management.api.health import router as management_health_router
from apps.management.api.resources import router as management_resources_router
from apps.management.api.security import router as management_security_router
from apps.organizations.api import router as organizations_router
from apps.organizations.business_api import router as business_router
from apps.services.api import router as services_router
from apps.services.individuals_api import router as individuals_router
from apps.services.inquiries_api import router as inquiries_router
from apps.support.api import router as support_router
from apps.trade.api import router as trade_router
from apps.transportation.api import router as transportation_router

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
api.add_router("/advertisements", advertising_router, tags=["advertising"])
api.add_router("/analysis", analysis_router, tags=["analysis and reports"])
api.add_router("/business", business_router, tags=["business accounts"])
api.add_router("/contact", contact_router, tags=["contact"])
api.add_router("/geography", geography_router, tags=["geography"])
api.add_router("/home", home_router, tags=["homepage"])
api.add_router("/intents", intents_router, tags=["user intent"])
api.add_router("/management/auth", management_auth_router, tags=["management authentication"])
api.add_router("/management/dashboard", management_dashboard_router, tags=["management dashboard"])
api.add_router("/management/health", management_health_router, tags=["management health"])
api.add_router("/management/resources", management_resources_router, tags=["management resources"])
api.add_router("/management/security", management_security_router, tags=["management security"])
api.add_router("/organizations", organizations_router, tags=["organizations"])
api.add_router("/individuals", individuals_router, tags=["individual businesses"])
api.add_router("/trade", trade_router, tags=["trade opportunities"])
api.add_router("/transport-companies", transportation_router, tags=["transportation"])
api.add_router("/services", services_router, tags=["individual product marketplace"])
api.add_router("/inquiries", inquiries_router, tags=["business inquiries"])
api.add_router("/support", support_router, tags=["support"])
