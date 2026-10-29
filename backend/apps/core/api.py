from django.conf import settings
from django.http import HttpRequest
from django.utils import timezone
from django.views.decorators.cache import never_cache
from ninja import Router, Status
from ninja.decorators import decorate_view

from apps.core import health
from apps.core.schemas import HealthOut, ReadinessOut

router = Router()


@router.get("/", response=HealthOut, summary="Liveness probe", operation_id="health_live")
@decorate_view(never_cache)
def liveness(request: HttpRequest) -> dict[str, object]:
    """The process is up. Does not touch dependencies."""
    return {
        "status": "ok",
        "service": "karfansa-backend",
        "version": settings.APP_VERSION,
        "time": timezone.now(),
    }


@router.get(
    "/ready/",
    response={200: ReadinessOut, 503: ReadinessOut},
    summary="Readiness probe",
    operation_id="health_ready",
)
@decorate_view(never_cache)
def readiness(request: HttpRequest) -> Status[dict[str, object]]:
    """The service can do real work: database and Redis respond."""
    results = health.run_checks()
    checks = {result.name: ("ok" if result.ok else "error") for result in results}
    if all(result.ok for result in results):
        return Status(200, {"status": "ok", "checks": checks})
    return Status(503, {"status": "unavailable", "checks": checks})
