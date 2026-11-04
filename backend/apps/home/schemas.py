from datetime import datetime

from ninja import Schema

from apps.home.models import Slide


class SlideOut(Schema):
    id: int
    title: str
    short_text: str
    description: str
    image: str | None
    created_at: datetime

    @staticmethod
    def resolve_image(obj: Slide) -> str | None:
        return obj.image.url if obj.image else None


class SlidesOut(Schema):
    results: list[SlideOut]
