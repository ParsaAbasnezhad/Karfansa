import hashlib

import pytest
from django.core.cache import cache
from django.test import Client

from apps.contact.models import ContactMessage

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _clear_cache() -> None:
    cache.clear()


def test_contact_message_is_saved_for_admin_review(client: Client) -> None:
    response = client.post(
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

    assert response.status_code == 201
    assert response.json()["message"] == "پیام شما با موفقیت ثبت شد."
    contact_message = ContactMessage.objects.get()
    assert contact_message.phone == "+989123456789"
    assert contact_message.email == "seller@example.com"
    assert not contact_message.is_read


def test_contact_message_rejects_honeypot_and_throttles(client: Client) -> None:
    spam = client.post(
        "/api/v1/contact/",
        {
            "name": "ربات",
            "phone": "09123456789",
            "email": "bot@example.com",
            "subject": "پشتیبانی فنی",
            "message": "این پیام از فیلد مخفی استفاده کرده است.",
            "website": "https://spam.example",
        },
        content_type="application/json",
    )
    assert spam.status_code == 400
    assert ContactMessage.objects.count() == 0

    throttle_key = f"contact-message:{hashlib.sha256(b'127.0.0.1').hexdigest()}"
    cache.delete(throttle_key)
    payload = {
        "name": "کاربر نمونه",
        "phone": "09123456789",
        "email": "user@example.com",
        "subject": "پشتیبانی فنی",
        "message": "این پیام برای بررسی محدودیت ارسال است.",
        "website": "",
    }
    for _ in range(5):
        response = client.post("/api/v1/contact/", payload, content_type="application/json")
        assert response.status_code == 201
    limited = client.post("/api/v1/contact/", payload, content_type="application/json")
    assert limited.status_code == 429


def test_contact_message_rejects_invalid_phone_and_subject(client: Client) -> None:
    payload = {
        "name": "کاربر نمونه",
        "phone": "123",
        "email": "user@example.com",
        "subject": "موضوع نامعتبر",
        "message": "این پیام برای بررسی اعتبارسنجی فرم است.",
        "website": "",
    }

    response = client.post("/api/v1/contact/", payload, content_type="application/json")

    assert response.status_code == 422
    assert ContactMessage.objects.count() == 0
