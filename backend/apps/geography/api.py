from django.db.models import QuerySet
from django.http import HttpRequest
from ninja import Router

from . import selectors
from .models import Country, Province
from .schemas import CountryOut, ProvinceOut

router = Router()


@router.get("/countries/", response=list[CountryOut], operation_id="geography_countries")
def countries(request: HttpRequest) -> QuerySet[Country]:
    return selectors.list_countries()


@router.get("/provinces/", response=list[ProvinceOut], operation_id="geography_provinces")
def provinces(request: HttpRequest, country: str | None = None) -> QuerySet[Province]:
    """Provinces, optionally filtered by country ISO code (for example ``?country=IR``)."""
    return selectors.list_provinces(country_iso2=country)
