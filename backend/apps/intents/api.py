from django.http import HttpRequest
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_protect
from ninja import Router, Status
from ninja.decorators import decorate_view

from apps.core.errors import ApiError
from apps.intents.models import UserIntent
from apps.intents.schemas import (
    ClaimIntentIn,
    GuestIntentIn,
    IntentCreateIn,
    IntentGoalsIn,
    IntentOut,
    SavedOut,
)
from apps.intents.services import (
    claim_guest_intent,
    create_guest_intent,
    create_user_intent,
    remove_user_contact,
    throttle_guest,
    update_user_goals,
)

router = Router()


def _user(request: HttpRequest):
    if not request.user.is_authenticated:
        raise ApiError("برای مدیریت اهداف وارد حساب شوید.", status_code=401)
    return request.user


def _intent_out(record: UserIntent | None) -> IntentOut:
    return IntentOut(
        has_intent=record is not None,
        goals=record.goals if record else [],
        contact_phone=record.contact_phone if record else "",
        contact_consent=record.contact_consent if record else False,
        created_at=record.created_at if record else None,
    )


@router.post("/guest", response={201: SavedOut})
@decorate_view(csrf_protect)
def save_guest(request: HttpRequest, payload: GuestIntentIn) -> Status[SavedOut]:
    if request.user.is_authenticated:
        raise ApiError("برای حساب واردشده از مسیر اهداف حساب استفاده کنید.", status_code=409)
    throttle_guest(request)
    if payload.website:
        raise ApiError("درخواست معتبر نیست.")
    create_guest_intent(
        token=payload.token,
        goals=payload.goals,
        phone=payload.contact_phone,
        consent=payload.contact_consent,
    )
    return Status(201, SavedOut(saved=True))


@router.get("/me", response=IntentOut)
@decorate_view(never_cache)
def my_intent(request: HttpRequest) -> IntentOut:
    user = _user(request)
    return _intent_out(UserIntent.objects.filter(user=user).first())


@router.post("/me", response={201: IntentOut})
@decorate_view(csrf_protect)
def save_my_intent(request: HttpRequest, payload: IntentCreateIn) -> Status[IntentOut]:
    record = create_user_intent(
        user=_user(request),
        goals=payload.goals,
        phone=payload.contact_phone,
        consent=payload.contact_consent,
    )
    return Status(201, _intent_out(record))


@router.put("/me/goals", response=IntentOut)
@decorate_view(csrf_protect)
def edit_my_goals(request: HttpRequest, payload: IntentGoalsIn) -> IntentOut:
    return _intent_out(update_user_goals(user=_user(request), goals=payload.goals))


@router.delete("/me/contact", response=IntentOut)
@decorate_view(csrf_protect)
def delete_my_contact(request: HttpRequest) -> IntentOut:
    return _intent_out(remove_user_contact(_user(request)))


@router.post("/claim", response=SavedOut)
@decorate_view(csrf_protect)
def claim_my_guest_intent(request: HttpRequest, payload: ClaimIntentIn) -> SavedOut:
    return SavedOut(saved=claim_guest_intent(_user(request), payload.token))
