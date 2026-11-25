"""Authenticated collaboration API built on the existing ProductInquiry table."""

import re
from datetime import date, datetime
from math import ceil
from urllib.parse import urlsplit
from uuid import UUID

from django.core.cache import cache
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from django.db import IntegrityError, transaction
from django.db.models import Count, Q
from django.http import HttpRequest
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.csrf import csrf_protect
from ninja import Router, Schema, Status
from ninja.decorators import decorate_view
from pydantic import Field

from apps.core.errors import ApiError
from apps.organizations.access import identity_or_default, require_user
from apps.organizations.models import INQUIRY_ROLES, MembershipStatus, OrganizationMember
from apps.services.models import (
    InquiryMessage,
    InquiryNotification,
    InquiryStatusEvent,
    ProductInquiry,
    ProductListing,
)

router = Router()
CATEGORIES = {"purchase", "partnership", "investment", "supply", "other"}
STATUS_LABELS = {
    "new": "جدید",
    "reviewing": "در حال بررسی",
    "accepted": "پذیرفته‌شده",
    "rejected": "ردشده",
    "read": "در حال بررسی",
    "replied": "در حال بررسی",
    "closed": "بسته‌شده",
}
TARGET_LABELS = {"trade": "فرصت تجاری", "product": "محصول", "service": "خدمت"}
KINDS = {
    "new": "درخواست همکاری جدید",
    "owner_reply": "پاسخ به درخواست همکاری",
    "applicant_reply": "پیام جدید متقاضی",
    "status": "تغییر وضعیت درخواست",
}


class InquiryCreateIn(Schema):
    target_type: str
    target_slug: str = Field(min_length=1, max_length=200)
    category: str
    subject: str = Field(min_length=3, max_length=180)
    message: str = Field(min_length=10, max_length=2000)
    client_key: UUID


class InquiryStatusIn(Schema):
    status: str


class InquiryMessageIn(Schema):
    body: str = Field(min_length=2, max_length=4000)


class MessageOut(Schema):
    sender_name: str
    sender_role: str
    body: str
    created_at: datetime


class EventOut(Schema):
    from_status: str
    to_status: str
    actor_name: str
    created_at: datetime


class InquiryOut(Schema):
    public_id: UUID
    target_type: str
    target_title: str
    target_url: str
    owner_name: str
    applicant_name: str
    category: str
    subject: str
    message: str
    status: str
    status_display: str
    created_at: datetime
    last_activity_at: datetime
    unread: bool


class InquiryDetailOut(InquiryOut):
    viewer_role: str
    messages: list[MessageOut]
    status_events: list[EventOut]


class InquiryPageOut(Schema):
    results: list[InquiryOut]
    count: int
    page: int
    page_size: int
    total_pages: int
    summary: dict[str, int]


class NotificationOut(Schema):
    id: int
    public_id: UUID
    kind: str
    title: str
    target_title: str
    created_at: datetime
    read: bool


class NotificationPageOut(Schema):
    results: list[NotificationOut]
    unread_count: int


class ContactOut(Schema):
    owner_name: str
    channels: list[dict[str, str]]


def _name(user: object) -> str:
    return f"{user.first_name} {user.last_name}".strip() or "کاربر کارفنسا"


def _target(inquiry: ProductInquiry) -> tuple[str, str, str]:
    if inquiry.trade_opportunity_id:
        item = inquiry.trade_opportunity
        return "trade", item.title, f"/trade/{item.slug}"
    item = inquiry.listing
    kind = item.listing_kind
    return kind, item.title, f"/services/listings/{item.slug}"


def _owner_name(inquiry: ProductInquiry) -> str:
    if inquiry.owner_organization_id:
        return inquiry.owner_organization.name
    if inquiry.owner_seller_id:
        return inquiry.owner_seller.display_name
    if inquiry.owner_user_id:
        return _name(inquiry.owner_user)
    return "کارفنسا"


def _owner_scope(request: HttpRequest, user: object):
    identity = identity_or_default(request, user)
    if identity and identity.organization is not None:
        if identity.role not in INQUIRY_ROLES:
            raise ApiError("اجازه دسترسی به درخواست‌های این شرکت را ندارید.", status_code=403)
        return Q(owner_organization=identity.organization)
    if identity and identity.seller is not None:
        return Q(owner_seller=identity.seller) | Q(owner_user=user)
    return Q(owner_user=user)


def _allowed(request: HttpRequest, inquiry: ProductInquiry, user: object) -> str:
    if inquiry.buyer_id == user.pk:
        return "applicant"
    if ProductInquiry.objects.filter(pk=inquiry.pk).filter(_owner_scope(request, user)).exists():
        return "owner"
    raise ApiError("درخواست پیدا نشد.", status_code=404)


def _queryset():
    return ProductInquiry.objects.select_related(
        "listing",
        "trade_opportunity",
        "buyer",
        "owner_organization",
        "owner_seller",
        "owner_user",
    )


def _serialize(inquiry: ProductInquiry, role: str) -> InquiryOut:
    target_type, title, url = _target(inquiry)
    seen = inquiry.owner_seen_at if role == "owner" else inquiry.applicant_seen_at
    return InquiryOut(
        public_id=inquiry.public_id,
        target_type=target_type,
        target_title=title,
        target_url=url,
        owner_name=_owner_name(inquiry),
        applicant_name=_name(inquiry.buyer),
        category=inquiry.category,
        subject=inquiry.subject or title,
        message=inquiry.message,
        status=inquiry.status,
        status_display=STATUS_LABELS.get(inquiry.status, inquiry.status),
        created_at=inquiry.created_at,
        last_activity_at=inquiry.last_activity_at,
        unread=seen is None or seen < inquiry.last_activity_at,
    )


def _detail(inquiry: ProductInquiry, role: str) -> InquiryDetailOut:
    base = _serialize(inquiry, role).model_dump()
    base.update(
        viewer_role=role,
        messages=[
            MessageOut(
                sender_name=_name(item.sender),
                sender_role="applicant" if item.sender_id == inquiry.buyer_id else "owner",
                body=item.body,
                created_at=item.created_at,
            )
            for item in inquiry.thread.all()
        ],
        status_events=[
            EventOut(
                from_status=item.from_status,
                to_status=item.to_status,
                actor_name=_name(item.actor),
                created_at=item.created_at,
            )
            for item in inquiry.status_events.all()
        ],
    )
    return InquiryDetailOut.model_validate(base)


def _recipients(inquiry: ProductInquiry) -> list[int]:
    if inquiry.owner_organization_id:
        return list(
            OrganizationMember.objects.filter(
                organization_id=inquiry.owner_organization_id,
                status=MembershipStatus.ACTIVE,
                role__in=INQUIRY_ROLES,
            ).values_list("user_id", flat=True)
        )
    if inquiry.owner_seller_id:
        return [inquiry.owner_seller.user_id]
    return [inquiry.owner_user_id] if inquiry.owner_user_id else []


def _notify(inquiry: ProductInquiry, kind: str, *, owner: bool) -> None:
    ids = _recipients(inquiry) if owner else [inquiry.buyer_id]
    InquiryNotification.objects.bulk_create(
        [
            InquiryNotification(inquiry=inquiry, recipient_id=pk, kind=kind)
            for pk in set(ids)
            if pk and pk != (inquiry.buyer_id if owner else None)
        ]
    )


def _resolve_target(target_type: str, slug: str):
    if target_type == "trade":
        from apps.trade.selectors import public_opportunities

        item = get_object_or_404(
            public_opportunities().select_related("created_by"),
            slug=slug,
        )
        if item.valid_until and item.valid_until < date.today():
            raise ApiError("این فرصت دیگر فعال نیست.", status_code=404)
        if item.company_id:
            if not item.company.is_active:
                raise ApiError("این فرصت دیگر فعال نیست.", status_code=404)
            return {"trade_opportunity": item, "owner_organization": item.company}
        if item.created_by_id:
            return {"trade_opportunity": item, "owner_user": item.created_by}
        raise ApiError("برای این فرصت دریافت درخواست فعال نیست.", status_code=404)
    if target_type not in {"product", "service"}:
        raise ApiError("نوع آگهی معتبر نیست.")
    item = get_object_or_404(
        ProductListing.objects.select_related("seller", "organization"),
        slug=slug,
        listing_kind=target_type,
        status=ProductListing.Status.APPROVED,
        is_active=True,
    )
    if item.seller_id and not item.seller.is_public:
        raise ApiError("این آگهی دیگر فعال نیست.", status_code=404)
    if item.organization_id:
        if not item.organization.is_active:
            raise ApiError("این آگهی دیگر فعال نیست.", status_code=404)
        return {"listing": item, "owner_organization": item.organization}
    return {"listing": item, "owner_seller": item.seller}


def _self_request(user: object, owners: dict) -> bool:
    org = owners.get("owner_organization")
    if (
        org
        and OrganizationMember.objects.filter(
            organization=org,
            user=user,
            status=MembershipStatus.ACTIVE,
        ).exists()
    ):
        return True
    seller = owners.get("owner_seller")
    return bool(
        (seller and seller.user_id == user.pk)
        or (owners.get("owner_user") and owners["owner_user"].pk == user.pk)
    )


@router.post("/", response={200: InquiryDetailOut, 201: InquiryDetailOut})
@decorate_view(csrf_protect)
def create(request: HttpRequest, payload: InquiryCreateIn) -> Status[InquiryDetailOut]:
    user = require_user(request)
    identity_or_default(request, user)
    existing = _queryset().filter(client_key=payload.client_key).first()
    if existing:
        if existing.buyer_id != user.pk:
            raise ApiError("شناسه درخواست تکراری است.", status_code=409)
        return Status(200, _detail(existing, "applicant"))
    category = payload.category.strip()
    subject = payload.subject.strip()
    message = payload.message.strip()
    if category not in CATEGORIES or len(subject) < 3 or len(message) < 10:
        raise ApiError("دسته، موضوع یا متن درخواست معتبر نیست.")
    owners = _resolve_target(payload.target_type, payload.target_slug)
    if _self_request(user, owners):
        raise ApiError("نمی‌توانید برای آگهی خودتان درخواست بفرستید.", status_code=403)
    key = f"inquiry-submit:{user.pk}:{payload.target_type}:{payload.target_slug}"
    if not cache.add(key, "1", timeout=5):
        raise ApiError("چند لحظه پیش درخواست ارسال کرده‌اید.", status_code=429)
    now = timezone.now()
    inquiry = ProductInquiry(
        buyer=user,
        category=category,
        subject=subject,
        message=message,
        client_key=payload.client_key,
        last_activity_at=now,
        applicant_seen_at=now,
        **owners,
    )
    try:
        with transaction.atomic():
            inquiry.full_clean()
            inquiry.save()
            _notify(inquiry, "new", owner=True)
    except DjangoValidationError as exc:
        cache.delete(key)
        raise ApiError("اطلاعات درخواست معتبر نیست.") from exc
    except IntegrityError as exc:
        cache.delete(key)
        raise ApiError("درخواست تکراری است.", status_code=409) from exc
    inquiry = _queryset().prefetch_related("thread", "status_events").get(pk=inquiry.pk)
    return Status(201, _detail(inquiry, "applicant"))


def _page(queryset, role: str, page: int, page_size: int) -> InquiryPageOut:
    summary = queryset.aggregate(
        total=Count("pk"),
        new=Count("pk", filter=Q(status="new")),
        reviewing=Count("pk", filter=Q(status__in=["reviewing", "read", "replied"])),
        accepted=Count("pk", filter=Q(status="accepted")),
        rejected=Count("pk", filter=Q(status="rejected")),
    )
    count = summary["total"]
    start = (page - 1) * page_size
    return InquiryPageOut(
        results=[_serialize(item, role) for item in queryset[start : start + page_size]],
        count=count,
        page=page,
        page_size=page_size,
        total_pages=max(1, ceil(count / page_size)),
        summary=summary,
    )


def _filtered(queryset, status: str, target_type: str, search: str, ordering: str):
    if status:
        if status not in STATUS_LABELS:
            raise ApiError("فیلتر وضعیت معتبر نیست.")
        queryset = queryset.filter(
            status__in=["reviewing", "read", "replied"] if status == "reviewing" else [status]
        )
    if target_type:
        if target_type == "trade":
            queryset = queryset.filter(trade_opportunity__isnull=False)
        elif target_type in {"product", "service"}:
            queryset = queryset.filter(listing__listing_kind=target_type)
        else:
            raise ApiError("فیلتر نوع آگهی معتبر نیست.")
    if search:
        queryset = queryset.filter(
            Q(subject__icontains=search)
            | Q(message__icontains=search)
            | Q(listing__title__icontains=search)
            | Q(trade_opportunity__title__icontains=search)
            | Q(buyer__first_name__icontains=search)
            | Q(buyer__last_name__icontains=search)
        )
    if ordering not in {"newest", "oldest"}:
        raise ApiError("ترتیب نمایش معتبر نیست.")
    sort_field = "last_activity_at" if ordering == "oldest" else "-last_activity_at"
    return queryset.order_by(sort_field, "-pk")


@router.get("/received", response=InquiryPageOut)
def received(
    request: HttpRequest,
    page: int = 1,
    page_size: int = 20,
    status: str = "",
    target_type: str = "",
    search: str = "",
    ordering: str = "newest",
) -> InquiryPageOut:
    user = require_user(request)
    if page < 1 or not 1 <= page_size <= 50 or len(search) > 100:
        raise ApiError("پارامترهای صفحه معتبر نیست.")
    base = _queryset().filter(_owner_scope(request, user))
    summary_base = base
    filtered = _filtered(base, status, target_type, search.strip(), ordering)
    result = _page(filtered, "owner", page, page_size)
    result.summary = _page_summary(summary_base)
    return result


def _page_summary(queryset) -> dict[str, int]:
    return queryset.aggregate(
        total=Count("pk"),
        new=Count("pk", filter=Q(status="new")),
        reviewing=Count("pk", filter=Q(status__in=["reviewing", "read", "replied"])),
        accepted=Count("pk", filter=Q(status="accepted")),
        rejected=Count("pk", filter=Q(status="rejected")),
    )


@router.get("/submitted", response=InquiryPageOut)
def submitted(
    request: HttpRequest,
    page: int = 1,
    page_size: int = 20,
    status: str = "",
    target_type: str = "",
    search: str = "",
    ordering: str = "newest",
) -> InquiryPageOut:
    user = require_user(request)
    if page < 1 or not 1 <= page_size <= 50 or len(search) > 100:
        raise ApiError("پارامترهای صفحه معتبر نیست.")
    base = _queryset().filter(buyer=user)
    result = _page(
        _filtered(base, status, target_type, search.strip(), ordering), "applicant", page, page_size
    )
    result.summary = _page_summary(base)
    return result


@router.get("/{public_id}", response=InquiryDetailOut)
def detail(request: HttpRequest, public_id: UUID) -> InquiryDetailOut:
    user = require_user(request)
    inquiry = get_object_or_404(
        _queryset().prefetch_related("thread__sender", "status_events__actor"),
        public_id=public_id,
    )
    role = _allowed(request, inquiry, user)
    now = timezone.now()
    field = "owner_seen_at" if role == "owner" else "applicant_seen_at"
    seen = getattr(inquiry, field)
    if seen is None or seen < inquiry.last_activity_at:
        ProductInquiry.objects.filter(pk=inquiry.pk).update(**{field: now})
        setattr(inquiry, field, now)
    InquiryNotification.objects.filter(
        inquiry=inquiry, recipient=user, read_at__isnull=True
    ).update(read_at=now)
    return _detail(inquiry, role)


@router.patch("/{public_id}/status", response=InquiryDetailOut)
@decorate_view(csrf_protect)
def change_status(
    request: HttpRequest, public_id: UUID, payload: InquiryStatusIn
) -> InquiryDetailOut:
    user = require_user(request)
    with transaction.atomic():
        inquiry = get_object_or_404(
            _queryset().select_for_update(of=("self",)), public_id=public_id
        )
        if _allowed(request, inquiry, user) != "owner":
            raise ApiError("فقط مالک می‌تواند وضعیت را تغییر دهد.", status_code=403)
        transitions = {
            "new": {"reviewing", "accepted", "rejected"},
            "reviewing": {"accepted", "rejected"},
            "read": {"reviewing", "accepted", "rejected"},
            "replied": {"reviewing", "accepted", "rejected"},
            "accepted": set(),
            "rejected": set(),
            "closed": set(),
        }
        if payload.status not in transitions.get(inquiry.status, set()):
            raise ApiError("تغییر وضعیت درخواست مجاز نیست.")
        old = inquiry.status
        now = timezone.now()
        inquiry.status = payload.status
        inquiry.last_activity_at = now
        inquiry.owner_seen_at = now
        inquiry.save(update_fields=["status", "last_activity_at", "owner_seen_at", "updated_at"])
        InquiryStatusEvent.objects.create(
            inquiry=inquiry, actor=user, from_status=old, to_status=payload.status
        )
        _notify(inquiry, "status", owner=False)
    return detail(request, public_id)


@router.post("/{public_id}/messages", response={201: InquiryDetailOut})
@decorate_view(csrf_protect)
def reply(
    request: HttpRequest, public_id: UUID, payload: InquiryMessageIn
) -> Status[InquiryDetailOut]:
    user = require_user(request)
    body = payload.body.strip()
    if len(body) < 2:
        raise ApiError("متن پیام کوتاه است.")
    key = f"inquiry-message:{user.pk}:{public_id}"
    try:
        with transaction.atomic():
            inquiry = get_object_or_404(
                _queryset().select_for_update(of=("self",)), public_id=public_id
            )
            role = _allowed(request, inquiry, user)
            if inquiry.status in {"rejected", "closed"}:
                raise ApiError("گفت‌وگوی این درخواست بسته است.")
            if not cache.add(key, "1", timeout=3):
                raise ApiError("پیام قبلی هنوز در حال ثبت است.", status_code=429)
            now = timezone.now()
            InquiryMessage.objects.create(inquiry=inquiry, sender=user, body=body)
            inquiry.last_activity_at = now
            field = "owner_seen_at" if role == "owner" else "applicant_seen_at"
            setattr(inquiry, field, now)
            inquiry.save(update_fields=["last_activity_at", field, "updated_at"])
            _notify(
                inquiry,
                "owner_reply" if role == "owner" else "applicant_reply",
                owner=role == "applicant",
            )
    except Exception:
        cache.delete(key)
        raise
    return Status(201, detail(request, public_id))


def _safe_url(value: str, host: str | None = None) -> str | None:
    try:
        if any(ord(char) < 33 for char in value):
            return None
        parsed = urlsplit(value.strip())
        if (
            parsed.scheme != "https"
            or not parsed.hostname
            or parsed.username
            or parsed.password
            or parsed.port not in (None, 443)
        ):
            return None
        if host and parsed.hostname.lower() not in {host, f"www.{host}"}:
            return None
        if host and not parsed.path.strip("/"):
            return None
        if host:
            handle = parsed.path.strip("/")
            pattern = r"[A-Za-z0-9_]{5,32}" if host == "t.me" else r"[A-Za-z0-9._]{1,30}"
            if not re.fullmatch(pattern, handle):
                return None
        return value.strip()
    except ValueError:
        return None


def _public_contacts(owner: object) -> list[dict[str, str]]:
    channels: list[dict[str, str]] = []
    phone = getattr(owner, "public_phone", "") or getattr(owner, "phone", "")
    email = getattr(owner, "public_email", "") or getattr(owner, "email", "")
    if phone and re.fullmatch(r"\+?[0-9][0-9 ()-]{5,20}", phone):
        channels.append({"label": "تلفن", "href": f"tel:{re.sub(r'[^+0-9]', '', phone)}"})
    if email:
        try:
            validate_email(email)
            channels.append({"label": "ایمیل", "href": f"mailto:{email}"})
        except DjangoValidationError:
            pass
    for field, label, host in (
        ("telegram", "تلگرام", "t.me"),
        ("instagram", "اینستاگرام", "instagram.com"),
        ("website", "وب‌سایت", None),
    ):
        value = getattr(owner, field, "")
        safe = _safe_url(value, host) if value else None
        if safe:
            channels.append({"label": label, "href": safe})
    return channels


@router.get("/contact/{target_type}/{slug}", response=ContactOut)
def public_contact(request: HttpRequest, target_type: str, slug: str) -> ContactOut:
    owners = _resolve_target(target_type, slug)
    org = owners.get("owner_organization")
    seller = owners.get("owner_seller")
    if org and not org.is_verified:
        return ContactOut(owner_name=org.name, channels=[])
    if seller and not seller.is_public:
        return ContactOut(owner_name=seller.display_name, channels=[])
    owner = org or seller
    if owner is None:
        return ContactOut(owner_name="کارفنسا", channels=[])
    return ContactOut(
        owner_name=owner.name if org else owner.display_name, channels=_public_contacts(owner)
    )


@router.get("/notifications/list", response=NotificationPageOut)
def notifications(request: HttpRequest) -> NotificationPageOut:
    user = require_user(request)
    scope = _owner_scope(request, user)
    visible = InquiryNotification.objects.filter(recipient=user).filter(
        Q(inquiry__buyer=user) | Q(inquiry__in=ProductInquiry.objects.filter(scope))
    )
    unread = visible.filter(read_at__isnull=True).count()
    items = visible.select_related("inquiry__listing", "inquiry__trade_opportunity").order_by(
        "-created_at"
    )[:20]
    return NotificationPageOut(
        results=[
            NotificationOut(
                id=item.pk,
                public_id=item.inquiry.public_id,
                kind=item.kind,
                title=KINDS.get(item.kind, "درخواست همکاری"),
                target_title=_target(item.inquiry)[1],
                created_at=item.created_at,
                read=item.read_at is not None,
            )
            for item in items
        ],
        unread_count=unread,
    )
