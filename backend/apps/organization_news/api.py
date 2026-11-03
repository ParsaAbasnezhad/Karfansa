from django.db.models import QuerySet
from django.http import HttpRequest
from ninja import Query, Router
from ninja.pagination import paginate

from . import selectors
from .models import OrganizationNews
from .schemas import NewsDetailOut, NewsFilters, NewsListOut

router = Router()


@router.get("/", response=list[NewsListOut], operation_id="news_list")
@paginate
def list_news(request: HttpRequest, filters: Query[NewsFilters]) -> QuerySet[OrganizationNews]:
    return selectors.list_published_news(**filters.model_dump())


@router.get("/{organization_slug}/{slug}/", response=NewsDetailOut, operation_id="news_detail")
def get_news(request: HttpRequest, organization_slug: str, slug: str) -> OrganizationNews:
    return selectors.get_published_news(organization_slug=organization_slug, slug=slug)
