from types import SimpleNamespace

import pytest
from django.contrib.auth import get_user_model
from ninja.errors import HttpError

from apps.management.api import resources
from apps.management.resources.registry import RESOURCES, get_resource
from apps.management.schemas.security import BulkResourceIn
from apps.support.models import SupportTicket, TicketMessage, TicketStatus


def test_user_resource_cannot_change_administrative_status() -> None:
    spec = get_resource("accounts.user")

    assert spec is not None
    assert "is_staff" not in spec.writable_fields
    assert "is_superuser" not in spec.writable_fields
    assert "is_active" not in spec.writable_fields


def test_retired_market_resources_are_absent_from_control_center_registry() -> None:
    assert get_resource("market.marketdataprovider") is None
    assert get_resource("market.marketindicator") is None
    assert get_resource("market.marketprice") is None
    assert all(not spec.slug.startswith("market.") for spec in RESOURCES)
    assert "apps.market" not in __import__("django.conf", fromlist=["settings"]).settings.INSTALLED_APPS


@pytest.mark.django_db
def test_delegated_administrator_cannot_modify_superuser(monkeypatch: pytest.MonkeyPatch) -> None:
    User = get_user_model()
    protected = User.objects.create_superuser(
        email="protected@example.test",
        password="not-used-by-this-test",
        phone="+989120000001",
    )
    actor = SimpleNamespace(is_superuser=False)
    monkeypatch.setattr(resources, "require_management", lambda *args, **kwargs: actor)
    request = SimpleNamespace(management_actor=actor)
    spec = get_resource("accounts.user")

    assert spec is not None
    with pytest.raises(HttpError, match="Protected administrator"):
        resources._check(request, spec, action="update", obj=protected)


@pytest.mark.django_db
def test_management_support_reply_uses_ticket_workflow(monkeypatch: pytest.MonkeyPatch) -> None:
    User = get_user_model()
    actor = User.objects.create_user(
        email="support-admin@example.test",
        phone="+989120000002",
        is_staff=True,
    )
    ticket = SupportTicket.objects.create(
        ticket_number="KF-20261127-A1B2C3",
        subject="Support request",
        contact_name="Customer",
        contact_email="customer@example.test",
    )
    request = SimpleNamespace(META={}, management_actor=actor, management_session={})
    monkeypatch.setattr(resources, "_item", lambda *args, **kwargs: ticket)
    monkeypatch.setattr(resources, "_check", lambda *args, **kwargs: actor)
    monkeypatch.setattr(resources, "require_recent_reauthentication", lambda *args, **kwargs: None)

    response = resources.create_ticket_message(
        request,
        str(ticket.pk),
        message="We have reviewed your request.",
        internal_note=False,
        attachment=None,
    )

    assert response.status_code == 201
    with pytest.raises(HttpError, match="Message is too long"):
        resources.create_ticket_message(
            request,
            str(ticket.pk),
            message="x" * 5001,
            internal_note=True,
            attachment=None,
        )
    ticket.refresh_from_db()
    message = TicketMessage.objects.get(ticket=ticket)
    assert message.sender == actor
    assert message.sender_type == "staff"
    assert not message.is_internal
    assert ticket.status == TicketStatus.ANSWERED
    assert response.value["message"] == message.message


@pytest.mark.django_db
def test_bulk_ticket_action_updates_all_selected_records_atomically(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    User = get_user_model()
    actor = User.objects.create_user(
        email="bulk-admin@example.test",
        phone="+989120000014",
        is_staff=True,
    )
    tickets = [
        SupportTicket.objects.create(
            ticket_number=f"KF-20261127-BULK{index}",
            subject="Support request",
            contact_name="Customer",
            contact_email=f"customer{index}@example.test",
        )
        for index in range(2)
    ]
    request = SimpleNamespace(META={}, management_actor=actor)
    monkeypatch.setattr(
        resources,
        "_item",
        lambda _request, _spec, item_id, lock=False: SupportTicket.objects.get(pk=item_id),
    )
    monkeypatch.setattr(resources, "_check", lambda *_args, **_kwargs: actor)
    monkeypatch.setattr(resources, "require_recent_reauthentication", lambda *_args, **_kwargs: None)

    result = resources.bulk_resource_action(
        request,
        "support.supportticket",
        BulkResourceIn(ids=[str(ticket.pk) for ticket in tickets], action="closed"),
    )

    assert result.processed == 2
    assert list(SupportTicket.objects.filter(pk__in=[ticket.pk for ticket in tickets]).values_list("status", flat=True)) == [
        TicketStatus.CLOSED,
        TicketStatus.CLOSED,
    ]
    assert TicketMessage.objects.filter(ticket__in=tickets, sender_type="system").count() == 2


@pytest.mark.django_db
def test_bulk_ticket_action_rolls_back_when_any_record_is_missing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    User = get_user_model()
    actor = User.objects.create_user(
        email="atomic-admin@example.test",
        phone="+989120000015",
        is_staff=True,
    )
    ticket = SupportTicket.objects.create(
        ticket_number="KF-20261127-ATOMIC",
        subject="Support request",
        contact_name="Customer",
        contact_email="customer@example.test",
    )
    request = SimpleNamespace(META={}, management_actor=actor)

    def get_ticket(_request, _spec, item_id, lock=False):
        if item_id == "missing":
            raise HttpError(404, "Record not found")
        return SupportTicket.objects.get(pk=item_id)

    monkeypatch.setattr(resources, "_item", get_ticket)
    monkeypatch.setattr(resources, "_check", lambda *_args, **_kwargs: actor)
    monkeypatch.setattr(resources, "require_recent_reauthentication", lambda *_args, **_kwargs: None)

    with pytest.raises(HttpError, match="Record not found"):
        resources.bulk_resource_action(
            request,
            "support.supportticket",
            BulkResourceIn(ids=[str(ticket.pk), "missing"], action="closed"),
        )

    ticket.refresh_from_db()
    assert ticket.status == TicketStatus.OPEN
    assert not TicketMessage.objects.filter(ticket=ticket, sender_type="system").exists()
