from datetime import datetime
from uuid import UUID

from ninja import Schema
from pydantic import Field


class GuestIntentIn(Schema):
    token: UUID
    goals: list[str] = Field(min_length=1, max_length=5)
    contact_phone: str = ""
    contact_consent: bool = False
    website: str = Field(default="", max_length=200)


class IntentCreateIn(Schema):
    goals: list[str] = Field(min_length=1, max_length=5)
    contact_phone: str = ""
    contact_consent: bool = False


class IntentGoalsIn(Schema):
    goals: list[str] = Field(max_length=5)


class ClaimIntentIn(Schema):
    token: UUID


class IntentOut(Schema):
    has_intent: bool
    goals: list[str]
    contact_phone: str
    contact_consent: bool
    created_at: datetime | None


class SavedOut(Schema):
    saved: bool
