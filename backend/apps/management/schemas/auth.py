from ninja import Schema


class PasswordLoginIn(Schema):
    email: str
    password: str


class CodeIn(Schema):
    code: str


class EnrollmentIn(Schema):
    enrollment_code: str


class ReauthIn(Schema):
    password: str
    code: str = ""


class CsrfOut(Schema):
    csrf_token: str


class AdminOut(Schema):
    id: int
    email: str
    name: str
    is_superuser: bool
    permissions: list[str]
    mfa_required: bool


class PasswordLoginOut(Schema):
    mfa_required: bool
    mfa_setup_required: bool
    admin: AdminOut | None = None


class SetupOut(Schema):
    secret: str
    provisioning_uri: str


class ConfirmOut(Schema):
    recovery_codes: list[str]
    admin: AdminOut


class MessageOut(Schema):
    message: str
