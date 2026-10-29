from datetime import datetime
from typing import Literal

from ninja import Schema


class ErrorBody(Schema):
    code: str
    message: str
    details: list[dict[str, object]] | None = None


class ErrorResponse(Schema):
    """Every API error uses this envelope."""

    error: ErrorBody


class HealthOut(Schema):
    status: Literal["ok"]
    service: str
    version: str
    time: datetime


class ReadinessOut(Schema):
    status: Literal["ok", "unavailable"]
    checks: dict[str, Literal["ok", "error"]]
