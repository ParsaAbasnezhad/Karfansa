from django.db.models import QuerySet
from django.http import HttpRequest
from ninja import Field, Query, Router, Schema
from ninja.pagination import LimitOffsetPagination, paginate

from . import selectors
from .models import TransportCompany, TransportMode
from .schemas import (
    TransportCompanyDetailOut,
    TransportCompanyFilters,
    TransportCompanyListOut,
    TransportModeOut,
)

router = Router()


class TransportPagination(LimitOffsetPagination):
    class Input(Schema):
        limit: int = Field(12, ge=1, le=100)
        offset: int = Field(0, ge=0)


@router.get("/", response=list[TransportCompanyListOut], operation_id="transport_companies_list")
@paginate(TransportPagination)
def list_transport_companies(
    request: HttpRequest, filters: Query[TransportCompanyFilters]
) -> QuerySet[TransportCompany]:
    return selectors.list_public_transport_companies(**filters.model_dump())


# Declared before "/{slug}/" so "transport-types" is never read as a company slug.
@router.get(
    "/transport-types/", response=list[TransportModeOut], operation_id="transport_types_list"
)
def list_transport_types(request: HttpRequest) -> QuerySet[TransportMode]:
    return selectors.list_transport_modes()


@router.get(
    "/{slug}/", response=TransportCompanyDetailOut, operation_id="transport_companies_detail"
)
def get_transport_company(request: HttpRequest, slug: str) -> TransportCompany:
    return selectors.get_public_transport_company(slug)
