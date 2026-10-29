"""One error envelope for the whole API:

    {"error": {"code": "...", "message": "...", "details": [...] | null}}

Handlers never leak internals. Unexpected exceptions are logged server-side and
returned as a generic 500.
"""

import logging
from http import HTTPStatus
from typing import Any

from django.http import Http404, HttpRequest, HttpResponse
from ninja import NinjaAPI
from ninja.errors import AuthenticationError, AuthorizationError, HttpError, ValidationError

logger = logging.getLogger(__name__)

_CODES_BY_STATUS = {
    HTTPStatus.BAD_REQUEST: "bad_request",
    HTTPStatus.UNAUTHORIZED: "not_authenticated",
    HTTPStatus.FORBIDDEN: "permission_denied",
    HTTPStatus.NOT_FOUND: "not_found",
    HTTPStatus.CONFLICT: "conflict",
    HTTPStatus.TOO_MANY_REQUESTS: "rate_limited",
}


class ApiError(Exception):
    """Raise from services/endpoints to produce a structured error response."""

    def __init__(
        self,
        message: str,
        *,
        status_code: int = HTTPStatus.BAD_REQUEST,
        code: str | None = None,
        details: list[dict[str, object]] | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = int(status_code)
        self.code = code or _CODES_BY_STATUS.get(HTTPStatus(self.status_code), "error")
        self.details = details


def error_payload(
    code: str, message: str, details: list[dict[str, object]] | None = None
) -> dict[str, Any]:
    return {"error": {"code": code, "message": message, "details": details}}


def register_exception_handlers(api: NinjaAPI) -> None:
    def respond(
        request: HttpRequest,
        status: int,
        code: str,
        message: str,
        details: list[dict[str, object]] | None = None,
    ) -> HttpResponse:
        return api.create_response(request, error_payload(code, message, details), status=status)

    @api.exception_handler(ApiError)
    def handle_api_error(request: HttpRequest, exc: ApiError) -> HttpResponse:
        return respond(request, exc.status_code, exc.code, exc.message, exc.details)

    @api.exception_handler(ValidationError)
    def handle_validation_error(request: HttpRequest, exc: ValidationError) -> HttpResponse:
        details = [dict(item) for item in exc.errors]
        return respond(request, 422, "validation_error", "Invalid request data.", details)

    @api.exception_handler(AuthenticationError)
    def handle_authentication_error(request: HttpRequest, exc: AuthenticationError) -> HttpResponse:
        return respond(request, 401, "not_authenticated", "Authentication is required.")

    @api.exception_handler(AuthorizationError)
    def handle_authorization_error(request: HttpRequest, exc: AuthorizationError) -> HttpResponse:
        return respond(request, 403, "permission_denied", "You do not have permission.")

    @api.exception_handler(Http404)
    def handle_not_found(request: HttpRequest, exc: Http404) -> HttpResponse:
        return respond(request, 404, "not_found", "Resource not found.")

    @api.exception_handler(HttpError)
    def handle_http_error(request: HttpRequest, exc: HttpError) -> HttpResponse:
        code = _CODES_BY_STATUS.get(HTTPStatus(exc.status_code), "error")
        return respond(request, exc.status_code, code, str(exc.message))

    @api.exception_handler(Exception)
    def handle_unexpected(request: HttpRequest, exc: Exception) -> HttpResponse:
        logger.exception("Unhandled API exception", exc_info=exc)
        return respond(request, 500, "internal_error", "An unexpected error occurred.")
