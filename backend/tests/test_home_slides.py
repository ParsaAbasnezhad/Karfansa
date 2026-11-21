import pytest
from django.test import Client

from apps.home.models import Slide

pytestmark = pytest.mark.django_db


def test_home_slides_api_returns_only_active_admin_slides(client: Client) -> None:
    active = Slide.objects.create(
        title="اسلاید فعال",
        short_text="متن کوتاه",
        description="شرح اسلاید",
        image="slides/active.jpg",
        is_active=True,
    )
    Slide.objects.create(
        title="اسلاید غیرفعال",
        short_text="متن کوتاه",
        description="شرح اسلاید",
        image="slides/inactive.jpg",
        is_active=False,
    )

    response = client.get("/api/v1/home/slides/")

    assert response.status_code == 200
    results = response.json()["results"]
    assert len(results) == 1
    assert results[0]["id"] == active.pk
    assert results[0]["title"] == active.title
    assert results[0]["image"] == "/media/slides/active.jpg"
