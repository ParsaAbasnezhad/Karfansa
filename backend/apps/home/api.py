from django.http import HttpRequest
from ninja import Router

from apps.home import selectors
from apps.home.models import AboutPageContent
from apps.home.schemas import AboutPageContentOut, SlidesOut

router = Router()


@router.get("/slides/", response=SlidesOut, operation_id="home_slides_list")
def list_slides(request: HttpRequest) -> dict[str, object]:
    return {"results": selectors.list_active_slides()}


@router.get("/about/", response=AboutPageContentOut, operation_id="home_about_content")
def get_about_page_content(request: HttpRequest) -> AboutPageContent:
    return selectors.get_about_page_content()
