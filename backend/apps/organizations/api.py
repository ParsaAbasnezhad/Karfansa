from django.db.models import QuerySet
from django.http import HttpRequest
from ninja import Query, Router
from ninja.pagination import paginate

from . import selectors
from .models import Industry, Organization
from .schemas import (
    IndustryOut,
    OrganizationDetailOut,
    OrganizationFilters,
    OrganizationListOut,
)

router = Router()


@router.get("/", response=list[OrganizationListOut], operation_id="organizations_list")
@paginate
def list_organizations(
    request: HttpRequest, filters: Query[OrganizationFilters]
) -> QuerySet[Organization]:
    return selectors.list_public_organizations(**filters.model_dump())


# Declared before "/{slug}/" so "industries" is never read as a company slug.
@router.get("/industries/", response=list[IndustryOut], operation_id="organizations_industries")
def list_industries(request: HttpRequest) -> QuerySet[Industry]:
    return selectors.list_industries()


@router.get("/{slug}/", response=OrganizationDetailOut, operation_id="organizations_detail")
def get_organization(request: HttpRequest, slug: str) -> Organization:
    return selectors.get_public_organization(slug)
