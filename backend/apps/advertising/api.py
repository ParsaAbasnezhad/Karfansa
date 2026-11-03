from django.db.models import QuerySet
from django.http import HttpRequest
from ninja import Router
from ninja.pagination import paginate

from . import selectors
from .models import Advertisement
from .schemas import AdvertisementOut

router = Router()


@router.get("/", response=list[AdvertisementOut], operation_id="advertisements_list")
@paginate
def list_advertisements(request: HttpRequest) -> QuerySet[Advertisement]:
    """Ads that are showing right now."""
    return selectors.list_active_advertisements()
