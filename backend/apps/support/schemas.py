from datetime import datetime

from ninja import Schema
from pydantic import Field, field_validator

from .models import TicketPriority


class TicketCreateIn(Schema):
    subject: str = Field(min_length=3, max_length=180)
    category: str
    message: str = Field(min_length=10, max_length=5000)
    priority: str = TicketPriority.NORMAL
    contact_name: str = Field(default="", max_length=120)
    contact_email: str = Field(default="", max_length=254)
    contact_phone: str = Field(default="", max_length=24)
    website: str = Field(default="", max_length=200)

    @field_validator(
        "subject",
        "category",
        "message",
        "priority",
        "contact_name",
        "contact_email",
        "contact_phone",
        "website",
        mode="before",
    )
    @classmethod
    def strip_text(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value


class TicketMessageIn(Schema):
    message: str = Field(min_length=1, max_length=5000)

    @field_validator("message", mode="before")
    @classmethod
    def strip_message(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value


class TicketMessageOut(Schema):
    id: str
    sender_type: str
    sender_type_display: str
    sender_label: str
    message: str
    attachment_url: str | None
    attachment_name: str | None
    created_at: datetime


class TicketListItemOut(Schema):
    id: str
    ticket_number: str
    subject: str
    category: str
    category_display: str
    priority: str
    status: str
    status_display: str
    last_message_excerpt: str
    last_message_at: datetime | None
    created_at: datetime
    updated_at: datetime
    has_unread: bool
    is_closed: bool


class TicketDetailOut(TicketListItemOut):
    contact_name: str
    contact_email: str
    contact_phone: str
    source: str
    closed_at: datetime | None
    access_token: str | None = None
    messages: list[TicketMessageOut]


class TicketPageOut(Schema):
    results: list[TicketListItemOut]
    count: int
    page: int
    page_size: int
    total_pages: int
    summary: "TicketSummaryOut"


class TicketSummaryOut(Schema):
    total: int
    open: int
    waiting_for_user: int
    answered: int
    unread: int


class TicketCreatedOut(Schema):
    ticket_number: str
    access_token: str | None = None
    message: str


TicketPageOut.model_rebuild()
