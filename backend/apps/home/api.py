from django.http import HttpRequest
from ninja import Router

from apps.home import selectors
from apps.home.schemas import SlidesOut

router = Router()


@router.get("/slides/", response=SlidesOut, operation_id="home_slides_list")
def list_slides(request: HttpRequest) -> dict[str, object]:
    return {"results": selectors.list_active_slides()}
