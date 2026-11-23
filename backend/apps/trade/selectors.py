from django.db.models import Q, QuerySet
from django.utils import timezone

from .models import OpportunityReviewStatus, TradeOpportunity


def visible_linked_listing_q() -> Q:
    approved = Q(service_listing__status="approved", service_listing__is_active=True)
    individual = approved & Q(
        service_listing__organization__isnull=True,
        service_listing__seller__is_public=True,
    )
    company = approved & Q(
        service_listing__organization__isnull=False,
        service_listing__organization__is_active=True,
    )
    return Q(service_listing__isnull=True) | individual | company


def public_opportunities(
    *,
    province: str = "",
    product: str = "",
    industry: str = "",
    opportunity_type: str = "",
    query: str = "",
    company: str = "",
    ordering: str = "newest",
) -> QuerySet[TradeOpportunity]:
    opportunities = (
        TradeOpportunity.objects.filter(
            province__is_published=True,
            review_status=OpportunityReviewStatus.APPROVED,
            is_published=True,
        )
        .filter(visible_linked_listing_q())
        .filter(Q(valid_until__isnull=True) | Q(valid_until__gte=timezone.localdate()))
        .select_related(
            "province",
            "city",
            "product",
            "industry",
            "company",
            "service_listing",
        )
    )
    if company:
        opportunities = opportunities.filter(company__slug=company)
    if province:
        opportunities = opportunities.filter(province__slug=province)
    if product:
        opportunities = opportunities.filter(
            Q(product__slug=product)
            | Q(service_listing__slug=product)
            | Q(service_listing__category__slug=product)
        )
    if industry:
        opportunities = opportunities.filter(industry__slug=industry)
    if opportunity_type:
        opportunities = opportunities.filter(opportunity_type=opportunity_type)
    if query:
        opportunities = opportunities.filter(
            Q(title__icontains=query)
            | Q(description__icontains=query)
            | Q(target_market__icontains=query)
            | Q(source__icontains=query)
            | Q(product__name_fa__icontains=query)
            | Q(product__name_en__icontains=query)
            | Q(industry__name_fa__icontains=query)
            | Q(industry__name_en__icontains=query)
            | Q(province__name_fa__icontains=query)
            | Q(city__name_fa__icontains=query)
            | Q(company__name__icontains=query)
        )
    if ordering == "relevance":
        return opportunities.order_by("-relevance_score", "-published_at", "title")
    return opportunities.order_by("-published_at", "title")


def user_opportunities(user_id: int) -> QuerySet[TradeOpportunity]:
    return (
        TradeOpportunity.objects.filter(created_by_id=user_id)
        .select_related("province", "city", "product", "industry", "company")
        .order_by("-created_at")
    )
