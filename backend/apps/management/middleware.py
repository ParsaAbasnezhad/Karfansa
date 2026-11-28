"""Host, CSRF, cache and independent session boundary for management APIs."""

from collections.abc import Callable

from django.conf import settings
from django.contrib.sessions.backends.db import SessionStore
from django.http import HttpRequest, HttpResponse, JsonResponse
from django.middleware.csrf import CsrfViewMiddleware


MANAGEMENT_PREFIX = "/api/v1/management/"
SAFE_METHODS = {"GET", "HEAD", "OPTIONS", "TRACE"}


def _no_store(response: HttpResponse) -> HttpResponse:
    response["Cache-Control"] = "private, no-store"
    response["Pragma"] = "no-cache"
    response["X-Frame-Options"] = "DENY"
    response["Referrer-Policy"] = "no-referrer"
    return response


class ManagementSecurityMiddleware:
    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response
        self.csrf = CsrfViewMiddleware(get_response)

    def __call__(self, request: HttpRequest) -> HttpResponse:
        if not request.path.startswith(MANAGEMENT_PREFIX):
            return self.get_response(request)

        host = request.get_host().split(":", 1)[0].lower()
        if host not in settings.MANAGEMENT_ALLOWED_HOSTS:
            return _no_store(JsonResponse({"detail": "Not found"}, status=404))

        cookie_name = settings.MANAGEMENT_SESSION_COOKIE_NAME
        request.management_session = SessionStore(request.COOKIES.get(cookie_name))  # type: ignore[attr-defined]

        if request.method not in SAFE_METHODS:
            # Ninja's public API view is CSRF exempt by default. Enforce CSRF
            # centrally so a future mutation cannot accidentally omit a decorator.
            rejected = self.csrf.process_view(request, lambda _request: None, (), {})
            if rejected is not None:
                return _no_store(rejected)

        response = self.get_response(request)
        session = request.management_session  # type: ignore[attr-defined]
        if session.modified:
            if session.is_empty():
                response.delete_cookie(cookie_name, path=MANAGEMENT_PREFIX)
            else:
                session.save()
                response.set_cookie(
                    cookie_name,
                    session.session_key,
                    max_age=session.get_expiry_age(),
                    path=MANAGEMENT_PREFIX,
                    secure=not settings.DEBUG,
                    httponly=True,
                    samesite="Strict",
                )
        return _no_store(response)
