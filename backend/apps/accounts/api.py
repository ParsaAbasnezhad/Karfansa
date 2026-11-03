from django.contrib.auth import login, logout
from django.http import HttpRequest
from django.middleware.csrf import get_token
from django.views.decorators.csrf import csrf_protect
from ninja import Router, Status
from ninja.decorators import decorate_view

from apps.accounts.schemas import (
    EmailIn,
    MessageOut,
    PasswordLoginIn,
    PasswordResetConfirmIn,
    PasswordResetIn,
    RegisterIn,
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

router = Router()


@router.get("/csrf", response=MessageOut)
def csrf_token(request: HttpRequest) -> dict[str, str]:
    return {"message": get_token(request)}


@router.post("/register", response={201: MessageOut})
@decorate_view(csrf_protect)
def register(request: HttpRequest, payload: RegisterIn) -> Status[dict[str, str]]:
    register_user(**payload.dict())
    return Status(
        201,
        {"message": "ثبت‌نام با موفقیت انجام شد. حالا با ایمیل و گذرواژه وارد شوید."},
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


@router.get("/me", response={200: UserOut, 401: MessageOut})
def me(request: HttpRequest) -> Status[UserOut | dict[str, str]]:
    if not request.user.is_authenticated:
        return Status(401, {"message": "وارد حساب کاربری نشده‌اید."})
    user = request.user
    return Status(200, UserOut(email=user.email, phone=user.phone))


@router.post("/logout", response=MessageOut)
@decorate_view(csrf_protect)
def logout_user(request: HttpRequest) -> dict[str, str]:
    logout(request)
    return {"message": "از حساب کاربری خارج شدید."}
