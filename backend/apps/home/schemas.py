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


class AboutPageContentOut(Schema):
    hero_title: str
    hero_intro: str
    story_title: str
    story_body: str
    mission_title: str
    mission_body: str
    vision_title: str
    vision_body: str
