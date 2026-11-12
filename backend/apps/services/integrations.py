from typing import Any

from django.utils import timezone

from apps.trade.models import OpportunityReviewStatus, OpportunityType, TradeOpportunity

from .models import ProductListing


def sync_product_opportunity(
    listing: ProductListing,
    *,
    reviewer: Any = None,
) -> TradeOpportunity | None:
    opportunity = TradeOpportunity.objects.filter(service_listing=listing).first()
    if opportunity is None and listing.status in {
        ProductListing.Status.DRAFT,
        ProductListing.Status.ARCHIVED,
    }:
        return None

    approved = (
        listing.status == ProductListing.Status.APPROVED
        and listing.is_active
    )
    if opportunity is None:
        opportunity = TradeOpportunity(service_listing=listing)

    opportunity.title = listing.title
    opportunity.province = listing.province
    opportunity.city = listing.city
    opportunity.opportunity_type = OpportunityType.BULK_SELL
    opportunity.description = listing.description
    opportunity.required_volume = listing.quantity
    opportunity.volume_unit = listing.unit
    opportunity.min_value = listing.price
    opportunity.max_value = listing.price
    opportunity.currency = listing.currency if listing.price is not None else ""
    opportunity.source = "محصول ثبت‌شده در بازار محصولات کارفنسا"
    opportunity.created_by = listing.seller.user
    opportunity.review_status = (
        OpportunityReviewStatus.APPROVED
        if approved
        else OpportunityReviewStatus.REJECTED
        if listing.status == ProductListing.Status.REJECTED
        else OpportunityReviewStatus.PENDING
    )
    opportunity.is_published = approved
    opportunity.published_at = timezone.now() if approved else None
    if reviewer and opportunity.review_status != OpportunityReviewStatus.PENDING:
        opportunity.last_reviewed_at = timezone.now()
        opportunity.last_reviewed_by = reviewer
    elif opportunity.review_status == OpportunityReviewStatus.PENDING:
        opportunity.last_reviewed_at = None
        opportunity.last_reviewed_by = None
    opportunity.save()
    return opportunity
