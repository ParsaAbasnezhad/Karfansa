"""Validated resource writes and established business workflow transitions."""

from datetime import timedelta
from typing import Any

from django.core.exceptions import ValidationError
from django.db import transaction
from django.forms import modelform_factory
from django.utils import timezone
from ninja.errors import HttpError

from apps.advertising.models import AdvertisementStatus
from apps.advertising.services.advertisement import archive as archive_advertisement
from apps.advertising.services.moderation import approve as approve_advertisement
from apps.advertising.services.moderation import reject as reject_advertisement
from apps.core.verification import VerificationStatus
from apps.geography.forms import ProvinceIndustryForm
from apps.management.audit import audit_management
from apps.services.integrations import sync_product_opportunity
from apps.services.models import ProductListing
from apps.support.models import TicketStatus
from apps.support.services import set_ticket_status
from apps.trade.models import OpportunityReviewStatus

from .registry import ResourceSpec

# Model-specific admin forms whose validation must be preserved verbatim.
ADMIN_FORMS: dict[str, type] = {
    "geography.provinceindustry": ProvinceIndustryForm,
}


def _errors(exc: ValidationError) -> dict[str, object]:
    return exc.message_dict if hasattr(exc, "message_dict") else {"__all__": exc.messages}


def _form_data(spec: ResourceSpec, instance: Any, changes: dict[str, Any]) -> dict[str, Any]:
    data: dict[str, Any] = {}
    if instance is not None:
        for name in (*spec.writable_fields, *spec.writable_many_to_many):
            field = spec.model._meta.get_field(name)
            if field.many_to_many:
                data[name] = list(getattr(instance, name).values_list("pk", flat=True))
            else:
                data[name] = getattr(instance, field.attname if field.is_relation else name)
    data.update(changes)
    return data


@transaction.atomic
def save_resource(request: Any, spec: ResourceSpec, changes: dict[str, Any], instance: Any = None) -> Any:
    if not spec.writable_fields:
        raise HttpError(405, "This resource is read-only")
    writable_fields = (*spec.writable_fields, *spec.writable_many_to_many)
    unknown = set(changes) - set(writable_fields)
    if unknown:
        raise HttpError(422, f"Fields are not writable: {', '.join(sorted(unknown))}")
    if not changes:
        raise HttpError(422, "No changes supplied")
    admin_form = ADMIN_FORMS.get(spec.slug)
    if admin_form is not None:
        form_class = modelform_factory(spec.model, form=admin_form, fields=list(writable_fields))
    else:
        form_class = modelform_factory(spec.model, fields=list(writable_fields))
    form = form_class(data=_form_data(spec, instance, changes), instance=instance)
    if not form.is_valid():
        raise HttpError(422, str(form.errors.get_json_data()))
    original_status = getattr(instance, "status", None)
    original_verification = getattr(instance, "verification_status", None)
    original_legal = (
        {name: getattr(instance, name) for name in ("name", "national_id", "registration_number", "economic_code")}
        if instance is not None and spec.slug == "organizations.organization" else {}
    )
    obj = form.save(commit=False)
    if spec.slug == "organizations.organization":
        legal_changed = any(original_legal[name] != getattr(obj, name) for name in original_legal)
        if original_verification == VerificationStatus.SUSPENDED:
            obj.verification_status = VerificationStatus.SUSPENDED
            obj.is_active = False
            obj.is_verified = False
        elif legal_changed and original_verification == VerificationStatus.VERIFIED:
            obj.verification_status = VerificationStatus.PENDING
            obj.submitted_at = timezone.now()
            obj.is_verified = False
            obj.rejection_reason = ""
    if spec.slug == "services.sellerprofile" and original_verification == VerificationStatus.SUSPENDED:
        obj.is_public = False
    try:
        m2m_fields = [field.name for field in spec.model._meta.many_to_many]
        if spec.slug != "geography.provinceindustry":
            # Pre-validate scalars + uniqueness before touching the database.
            obj.full_clean(exclude=m2m_fields)
        obj.save()
        form.save_m2m()
        # Re-validate after many-to-many persistence so model ``clean`` sees the
        # submitted relations (e.g. ProvinceIndustry.active_cities).
        obj.full_clean()
        if spec.slug == "services.productlisting":
            material = set(spec.writable_fields) - {"seller", "organization"}
            if original_status == ProductListing.Status.APPROVED and material.intersection(form.changed_data):
                obj.transition_to(ProductListing.Status.PENDING_REVIEW)
            sync_product_opportunity(obj, reviewer=request.management_actor)
        if spec.slug == "trade.tradeopportunity" and instance is not None:
            review_fields = set(spec.writable_fields) - {"relevance_score"}
            if obj.review_status == OpportunityReviewStatus.APPROVED and review_fields.intersection(form.changed_data):
                obj.review_status = OpportunityReviewStatus.PENDING
                obj.is_published = False
                obj.published_at = None
                obj.scheduled_for = None
                obj.rejection_reason = ""
                obj.full_clean()
                obj.save(update_fields=["review_status", "is_published", "published_at", "scheduled_for", "rejection_reason", "updated_at"])
    except ValidationError as exc:
        raise HttpError(422, str(_errors(exc))) from exc
    audit_management(request, "resource.create" if instance is None else "resource.update", obj, form.changed_data)
    return obj


@transaction.atomic
def perform_action(request: Any, spec: ResourceSpec, obj: Any, action: str, reason: str = "") -> Any:
    reason = reason.strip()
    selected = next((item for item in spec.actions if item.key == action), None)
    if selected is None:
        raise HttpError(404, "Unknown action")
    if selected.requires_reason and not reason:
        raise HttpError(422, "A reason is required")
    actor = request.management_actor
    now = timezone.now()
    try:
        if spec.slug == "organizations.organization":
            mapping = {"approve": VerificationStatus.VERIFIED, "reject": VerificationStatus.REJECTED,
                       "suspend": VerificationStatus.SUSPENDED, "reactivate": VerificationStatus.VERIFIED}
            obj.verification_status = mapping[action]
            obj.rejection_reason = reason if action == "reject" else ""
            obj.is_verified = action in {"approve", "reactivate"}
            obj.is_active = action in {"approve", "reactivate"}
            obj.reviewed_at = now
            obj.reviewed_by = actor
            obj.full_clean()
            obj.save()
        elif spec.slug == "services.sellerprofile":
            mapping = {"approve": VerificationStatus.VERIFIED, "reject": VerificationStatus.REJECTED,
                       "suspend": VerificationStatus.SUSPENDED, "reactivate": VerificationStatus.VERIFIED}
            obj.verification_status = mapping[action]
            obj.rejection_reason = reason if action == "reject" else ""
            if action == "suspend":
                obj.is_public = False
            obj.reviewed_at = now
            obj.reviewed_by = actor
            obj.full_clean()
            obj.save()
        elif spec.slug == "services.productlisting":
            if action == "request_changes":
                if obj.status != ProductListing.Status.PENDING_REVIEW:
                    raise HttpError(409, "Listing is not pending review")
                obj.transition_to(ProductListing.Status.DRAFT)
                obj.rejection_reason = reason
                obj.reviewed_at = now
                obj.reviewed_by = actor
                obj.save(update_fields=["rejection_reason", "reviewed_at", "reviewed_by", "updated_at"])
            else:
                status = {"approve": ProductListing.Status.APPROVED,
                          "reject": ProductListing.Status.REJECTED,
                          "unpublish": ProductListing.Status.ARCHIVED}[action]
                obj.transition_to(status, reviewer=actor, rejection_reason=reason)
            sync_product_opportunity(obj, reviewer=actor)
        elif spec.slug == "trade.tradeopportunity":
            if action in {"approve_publish", "approve_only"}:
                obj.review_status = OpportunityReviewStatus.APPROVED
                obj.is_published = action == "approve_publish" and not obj.is_expired
                obj.published_at = now if obj.is_published else None
                obj.scheduled_for = None
                obj.rejection_reason = ""
            elif action in {"reject", "request_changes"}:
                obj.review_status = OpportunityReviewStatus.REJECTED if action == "reject" else OpportunityReviewStatus.PENDING
                obj.is_published = False
                obj.published_at = None
                obj.scheduled_for = None
                obj.rejection_reason = reason
            elif action == "unpublish":
                obj.is_published = False
                obj.published_at = None
                obj.scheduled_for = None
            elif action == "expire":
                obj.valid_until = timezone.localdate() - timedelta(days=1)
                obj.is_published = False
                obj.published_at = None
                obj.scheduled_for = None
            obj.last_reviewed_at = now
            obj.last_reviewed_by = actor
            obj.full_clean()
            obj.save()
        elif spec.slug == "advertising.advertisement":
            if action == "publish":
                approve_advertisement(obj)
            elif action == "reject":
                reject_advertisement(obj, reason=reason)
            else:
                archive_advertisement(obj)
        elif spec.slug == "organizations.verificationdocument":
            obj.review_status = "approved" if action == "approve" else "rejected"
            obj.rejection_reason = reason if action == "reject" else ""
            obj.reviewer = actor
            obj.reviewed_at = now
            obj.full_clean()
            obj.save()
        elif spec.slug == "support.supportticket":
            status = {"in_progress": TicketStatus.IN_PROGRESS,
                      "waiting_for_user": TicketStatus.WAITING_FOR_USER,
                      "closed": TicketStatus.CLOSED}[action]
            set_ticket_status(obj, status, actor=actor)
        elif spec.slug == "transportation.transportcompany":
            obj.is_verified = action == "verify"
            obj.is_active = action != "suspend"
            obj.full_clean()
            obj.save()
        else:
            raise HttpError(404, "Unknown action")
    except ValidationError as exc:
        raise HttpError(422, str(_errors(exc))) from exc
    audit_management(request, f"{spec.slug}.{action}", obj, ("status", "review_status", "verification_status"))
    return obj
