from io import BytesIO

import pytest
from django.contrib.admin.sites import AdminSite
from django.core import mail
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, RequestFactory
from django.urls import reverse
from PIL import Image

from apps.accounts.models import User
from apps.contact.models import ContactMessage
from apps.support.admin import SupportTicketAdmin
from apps.support.models import SenderType, SupportTicket, TicketMessage, TicketStatus
from apps.support.services import add_internal_note, add_staff_reply, create_support_ticket

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _clear_cache() -> None:
    cache.clear()


def _user(email: str, phone: str, **fields: object) -> User:
    return User.objects.create_user(email=email, phone=phone, password="Qw9!sX4mN2#kL7pV", **fields)


def _png(name: str = "note.png") -> SimpleUploadedFile:
    buffer = BytesIO()
    Image.new("RGB", (8, 8), color="blue").save(buffer, format="PNG")
    return SimpleUploadedFile(name, buffer.getvalue(), content_type="image/png")


def _create_form(**overrides: str) -> dict[str, str]:
    payload = {
        "subject": "خطا در ورود به حساب",
        "category": "technical",
        "message": "هنگام ورود پیام خطا می‌بینم و نمی‌توانم ادامه بدهم.",
        "priority": "normal",
        "contact_name": "سارا احمدی",
        "contact_email": "sara@example.com",
        "contact_phone": "+989121234567",
        "website": "",
    }
    payload.update(overrides)
    return payload


def test_authenticated_user_creates_and_lists_own_tickets(client: Client) -> None:
    user = _user("sara@example.com", "+989121234567", first_name="سارا", last_name="احمدی")
    client.force_login(user)

    created = client.post("/api/v1/support/tickets/", data=_create_form())
    assert created.status_code == 201, created.content
    body = created.json()
    assert body["access_token"] is None
    ticket = SupportTicket.objects.get(ticket_number=body["ticket_number"])
    assert ticket.user_id == user.pk
    assert ticket.status == TicketStatus.OPEN
    assert ticket.messages.count() == 1
    assert mail.outbox

    listing = client.get("/api/v1/support/tickets/")
    assert listing.status_code == 200
    data = listing.json()
    assert data["count"] == 1
    assert data["summary"]["total"] == 1
    assert data["results"][0]["ticket_number"] == ticket.ticket_number


def test_guest_ticket_requires_access_token_and_hides_internal_notes(client: Client) -> None:
    created = client.post(
        "/api/v1/support/tickets/",
        data=_create_form(contact_email="guest@example.com"),
    )
    assert created.status_code == 201
    payload = created.json()
    number = payload["ticket_number"]
    token = payload["access_token"]
    assert token

    denied = client.get(f"/api/v1/support/tickets/{number}/")
    assert denied.status_code == 404

    other = client.get(f"/api/v1/support/tickets/{number}/", {"access_token": "wrong-token"})
    assert other.status_code == 404

    detail = client.get(f"/api/v1/support/tickets/{number}/", {"access_token": token})
    assert detail.status_code == 200
    assert detail.json()["ticket_number"] == number

    ticket = SupportTicket.objects.get(ticket_number=number)
    staff = _user("staff@example.com", "+989129999999", is_staff=True)
    add_staff_reply(ticket=ticket, sender=staff, message="پاسخ عمومی پشتیبانی برای پیگیری.")
    add_internal_note(ticket=ticket, sender=staff, message="یادداشت محرمانه برای تیم.")

    visible = client.get(f"/api/v1/support/tickets/{number}/", {"access_token": token})
    texts = [item["message"] for item in visible.json()["messages"]]
    assert "پاسخ عمومی پشتیبانی برای پیگیری." in texts
    assert "یادداشت محرمانه برای تیم." not in texts
    assert all(
        item["sender_type"] != "staff" or item["sender_label"] == "پشتیبانی کارفنسا"
        for item in visible.json()["messages"]
        if item["sender_type"] == "staff"
    )


def test_users_cannot_access_someone_elses_ticket(client: Client) -> None:
    owner = _user("owner@example.com", "+989111111111")
    stranger = _user("other@example.com", "+989122222222")
    ticket, _ = create_support_ticket(
        user=owner,
        subject="موضوع خصوصی کاربر",
        message="این درخواست فقط برای صاحب حساب قابل مشاهده است.",
        category="technical",
    )
    client.force_login(stranger)
    response = client.get(f"/api/v1/support/tickets/{ticket.ticket_number}/")
    assert response.status_code == 404
    listing = client.get("/api/v1/support/tickets/")
    assert listing.json()["count"] == 0


def test_user_reply_and_close_status_transitions(client: Client) -> None:
    user = _user("user@example.com", "+989133333333")
    staff = _user("help@example.com", "+989144444444", is_staff=True)
    ticket, _ = create_support_ticket(
        user=user,
        subject="پیگیری سفارش",
        message="لطفاً وضعیت درخواست ثبت شرکت را بررسی کنید.",
        category="company",
    )
    add_staff_reply(
        ticket=ticket, sender=staff, message="درخواست شما دریافت شد و در حال بررسی است."
    )
    ticket.refresh_from_db()
    assert ticket.status == TicketStatus.ANSWERED

    client.force_login(user)
    detail = client.get(f"/api/v1/support/tickets/{ticket.ticket_number}/")
    assert detail.json()["has_unread"] is False

    replied = client.post(
        f"/api/v1/support/tickets/{ticket.ticket_number}/messages/",
        data={"message": "ممنون، فایل تکمیلی هم ارسال می‌کنم."},
    )
    assert replied.status_code == 201
    ticket.refresh_from_db()
    assert ticket.status == TicketStatus.IN_PROGRESS

    closed = client.post(f"/api/v1/support/tickets/{ticket.ticket_number}/close/")
    assert closed.status_code == 200
    ticket.refresh_from_db()
    assert ticket.status == TicketStatus.CLOSED
    blocked = client.post(
        f"/api/v1/support/tickets/{ticket.ticket_number}/messages/",
        data={"message": "یک پیام دیگر پس از بسته شدن تیکت."},
    )
    assert blocked.status_code == 400


def test_invalid_attachment_is_rejected(client: Client) -> None:
    user = _user("files@example.com", "+989155555555")
    client.force_login(user)
    created = client.post("/api/v1/support/tickets/", data=_create_form())
    number = created.json()["ticket_number"]
    bad = SimpleUploadedFile("payload.exe", b"MZ-malware", content_type="application/octet-stream")
    response = client.post(
        f"/api/v1/support/tickets/{number}/messages/",
        data={"message": "این فایل باید رد شود.", "attachment": bad},
    )
    assert response.status_code in {400, 422}
    assert TicketMessage.objects.filter(ticket__ticket_number=number).count() == 1

    ok = client.post(
        f"/api/v1/support/tickets/{number}/messages/",
        data={"message": "تصویر راهنما پیوست شد.", "attachment": _png()},
    )
    assert ok.status_code == 201, ok.content
    message = (
        TicketMessage.objects.filter(ticket__ticket_number=number).exclude(attachment="").get()
    )
    download = client.get(f"/api/v1/support/tickets/{number}/messages/{message.pk}/attachment/")
    assert download.status_code == 200
    assert download.get("Content-Disposition", "").startswith("attachment")

    outsider = _user("outsider@example.com", "+989166666666")
    client.force_login(outsider)
    stolen = client.get(f"/api/v1/support/tickets/{number}/messages/{message.pk}/attachment/")
    assert stolen.status_code == 404


def test_contact_form_creates_support_ticket_for_guests_and_users(client: Client) -> None:
    guest = client.post(
        "/api/v1/contact/",
        {
            "name": "فروشنده نمونه",
            "phone": "۰۹۱۲۳۴۵۶۷۸۹",
            "email": "seller@example.com",
            "subject": "همکاری تجاری",
            "message": "برای همکاری درباره معرفی محصولات پیام می‌دهم.",
            "website": "",
        },
        content_type="application/json",
    )
    assert guest.status_code == 201
    data = guest.json()
    assert data["ticket_number"]
    assert data["access_token"]
    assert ContactMessage.objects.count() == 1
    ticket = SupportTicket.objects.get(ticket_number=data["ticket_number"])
    assert ticket.user_id is None
    assert ticket.source == "contact"

    user = _user("member@example.com", "+989177777777", first_name="ندا")
    client.force_login(user)
    member = client.post(
        "/api/v1/contact/",
        {
            "name": "ندا",
            "phone": "09128888888",
            "email": "member@example.com",
            "subject": "پشتیبانی فنی",
            "message": "برای حساب کاربری‌ام به راهنمایی نیاز دارم.",
            "website": "",
        },
        content_type="application/json",
    )
    assert member.status_code == 201
    assert member.json()["access_token"] is None
    owned = SupportTicket.objects.get(ticket_number=member.json()["ticket_number"])
    assert owned.user_id == user.pk


def test_admin_staff_reply_creates_visible_message() -> None:
    user = _user("admin-user@example.com", "+989188888888")
    staff = _user("admin-staff@example.com", "+989199999999", is_staff=True, is_superuser=True)
    ticket, _ = create_support_ticket(
        user=user,
        subject="نیاز به بررسی مدیر",
        message="لطفاً این مورد را از پنل مدیریت پاسخ دهید.",
        category="other",
    )
    factory = RequestFactory()
    request = factory.post("/admin/support/supportticket/")
    request.user = staff

    class Form:
        cleaned_data = {
            "status": TicketStatus.ANSWERED,
            "staff_reply": "پاسخ ثبت‌شده از ادمین برای کاربر.",
            "internal_note": "فقط برای همکاران.",
            "reply_attachment": None,
        }

    admin = SupportTicketAdmin(SupportTicket, AdminSite())
    admin.save_model(request, ticket, Form(), change=True)
    ticket.refresh_from_db()
    assert ticket.status == TicketStatus.ANSWERED
    assert (
        TicketMessage.objects.filter(
            ticket=ticket, is_internal=False, sender_type=SenderType.STAFF
        ).count()
        == 1
    )
    assert TicketMessage.objects.filter(ticket=ticket, is_internal=True).count() == 1

    client = Client()
    client.force_login(staff)
    changelist = client.get(reverse("admin:support_supportticket_changelist"))
    assert changelist.status_code == 200
    assert ticket.ticket_number in changelist.content.decode()
