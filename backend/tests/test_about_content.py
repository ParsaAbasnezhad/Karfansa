import pytest
from django.test import Client

from apps.home.models import AboutPageContent

pytestmark = pytest.mark.django_db


def test_about_page_content_is_served_and_admin_editable(client: Client) -> None:
    content = AboutPageContent.objects.get(pk=1)
    content.story_body = "متن ویرایش‌شده توسط مدیر"
    content.save(update_fields=["story_body", "updated_at"])

    response = client.get("/api/v1/home/about/")

    assert response.status_code == 200
    assert response.json()["story_body"] == "متن ویرایش‌شده توسط مدیر"
