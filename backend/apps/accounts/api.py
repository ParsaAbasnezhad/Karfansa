from django.contrib.auth import login, logout
from django.db import transaction
from django.http import HttpRequest
from django.middleware.csrf import get_token
from django.views.decorators.csrf import csrf_protect
from ninja import Router, Status
from ninja.decorators import decorate_view

from apps.accounts.phone import login_with_phone, register_with_phone, request_phone_otp
from apps.accounts.schemas import (
    EmailIn,
    MessageOut,
    PasswordLoginIn,
    PasswordResetConfirmIn,
    PasswordResetIn,
    PhoneLoginIn,
    PhoneOtpIn,
    PhoneRegisterIn,
    PhoneRegistrationOut,
    ProfileOut,
    ProfileUpdateIn,
    RegisterIn,
    RegistrationOut,
    UserOut,
    VerifyIn,
)
from apps.accounts.services import (
    password_login,
    register_user,
    reset_password,
    send_login_code,
    send_password_reset,
    verify_login_code,
)
from apps.core.errors import ApiError
from apps.geography.models import City, Province
from apps.intents.services import claim_guest_intent

router = Router()


@router.get("/csrf", response=MessageOut)
def csrf_token(request: HttpRequest) -> dict[str, str]:
    return {"message": get_token(request)}


@router.post("/register", response={201: RegistrationOut})
@decorate_view(csrf_protect)
def register(request: HttpRequest, payload: RegisterIn) -> Status[RegistrationOut]:
    with transaction.atomic():
        user = register_user(email=payload.email, phone=payload.phone, password=payload.password)
        claimed = claim_guest_intent(user, payload.guest_intent_token)
    return Status(
        201,
        RegistrationOut(
            message="ثبت‌نام با موفقیت انجام شد. حالا با ایمیل و گذرواژه وارد شوید.",
            intent_claimed=claimed,
        ),
    )


@router.post("/password-login", response=UserOut)
@decorate_view(csrf_protect)
def login_with_password(request: HttpRequest, payload: PasswordLoginIn) -> UserOut:
    user = password_login(payload.email, payload.password)
    login(request, user, backend="django.contrib.auth.backends.ModelBackend")
    return UserOut(email=user.email, phone=user.phone)


@router.post("/password-reset", response=MessageOut)
@decorate_view(csrf_protect)
def request_password_reset(request: HttpRequest, payload: PasswordResetIn) -> dict[str, str]:
    send_password_reset(payload.email)
    return {"message": "اگر این ایمیل ثبت شده باشد، کد بازیابی برای آن ارسال می‌شود."}


@router.post("/password-reset/confirm", response=MessageOut)
@decorate_view(csrf_protect)
def confirm_password_reset(request: HttpRequest, payload: PasswordResetConfirmIn) -> dict[str, str]:
    reset_password(payload.email, payload.code, payload.password)
    return {"message": "گذرواژه با موفقیت تغییر کرد. حالا وارد شوید."}


@router.post("/phone/otp", response=MessageOut)
@decorate_view(csrf_protect)
def request_phone_code(request: HttpRequest, payload: PhoneOtpIn) -> dict[str, str]:
    request_phone_otp(payload.phone, payload.email)
    return {"message": "اگر ارسال کد ممکن باشد، کد تأیید ارسال می‌شود."}


@router.post("/phone/register", response={201: PhoneRegistrationOut})
@decorate_view(csrf_protect)
def register_with_phone_code(
    request: HttpRequest, payload: PhoneRegisterIn
) -> Status[PhoneRegistrationOut]:
    with transaction.atomic():
        user = register_with_phone(
            phone=payload.phone,
            code=payload.code,
            email=payload.email,
            password=payload.password,
            first_name=payload.first_name,
            last_name=payload.last_name,
        )
        claimed = claim_guest_intent(user, payload.guest_intent_token)
    login(request, user, backend="django.contrib.auth.backends.ModelBackend")
    return Status(
        201,
        PhoneRegistrationOut(email=user.email, phone=user.phone, intent_claimed=claimed),
    )


@router.post("/phone/login", response=UserOut)
@decorate_view(csrf_protect)
def login_with_phone_code(request: HttpRequest, payload: PhoneLoginIn) -> UserOut:
    user = login_with_phone(payload.phone, payload.code)
    login(request, user, backend="django.contrib.auth.backends.ModelBackend")
    return UserOut(email=user.email, phone=user.phone)


@router.post("/login", response=MessageOut)
@decorate_view(csrf_protect)
def request_login_code(request: HttpRequest, payload: EmailIn) -> dict[str, str]:
    send_login_code(payload.email)
    return {"message": "اگر این ایمیل در کارفنسا ثبت شده باشد، کد ورود برای آن ارسال می‌شود."}


@router.post("/verify", response=UserOut)
@decorate_view(csrf_protect)
def verify_code(request: HttpRequest, payload: VerifyIn) -> UserOut:
    user = verify_login_code(payload.email, payload.code)
    login(request, user, backend="django.contrib.auth.backends.ModelBackend")
    return UserOut(email=user.email, phone=user.phone)


@router.get("/me", response={200: ProfileOut, 401: MessageOut})
def me(request: HttpRequest) -> Status[ProfileOut | dict[str, str]]:
    if not request.user.is_authenticated:
        return Status(401, {"message": "وارد حساب کاربری نشده‌اید."})
    user = request.user
    return Status(
        200,
        ProfileOut(
            email=user.email,
            phone=user.phone,
            first_name=user.first_name,
            last_name=user.last_name,
            date_joined=user.date_joined,
            province_id=user.province_id,
            province_name=user.province.name_fa if user.province_id else None,
            city_id=user.city_id,
            city_name=user.city.name_fa if user.city_id else None,
        ),
    )


@router.patch("/me", response={200: ProfileOut, 401: MessageOut})
@decorate_view(csrf_protect)
def update_profile(
    request: HttpRequest,
    payload: ProfileUpdateIn,
) -> Status[ProfileOut | dict[str, str]]:
    if not request.user.is_authenticated:
        return Status(401, {"message": "وارد حساب کاربری نشده‌اید."})
    user = request.user
    province = Province.objects.filter(
        pk=payload.province_id,
        country__iso2="IR",
    ).first()
    if province is None:
        raise ApiError("استان انتخاب‌شده معتبر نیست.")
    city = City.objects.filter(pk=payload.city_id, province=province).first()
    if city is None:
        raise ApiError("شهر انتخاب‌شده با استان انتخابی مطابقت ندارد.")
    user.first_name = payload.first_name.strip()
    user.last_name = payload.last_name.strip()
    if not user.first_name or not user.last_name:
        raise ApiError("نام و نام خانوادگی را کامل وارد کنید.")
    user.province = province
    user.city = city
    user.save(update_fields=["first_name", "last_name", "province", "city"])
    return Status(
        200,
        ProfileOut(
            email=user.email,
            phone=user.phone,
            first_name=user.first_name,
            last_name=user.last_name,
            date_joined=user.date_joined,
            province_id=user.province_id,
            province_name=province.name_fa,
            city_id=user.city_id,
            city_name=city.name_fa,
        ),
    )


@router.post("/logout", response=MessageOut)
@decorate_view(csrf_protect)
def logout_user(request: HttpRequest) -> dict[str, str]:
    logout(request)
    return {"message": "از حساب کاربری خارج شدید."}
