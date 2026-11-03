from ninja import Schema


class RegisterIn(Schema):
    email: str
    phone: str
    password: str


class EmailIn(Schema):
    email: str


class VerifyIn(Schema):
    email: str
    code: str


class PasswordLoginIn(Schema):
    email: str
    password: str


class PasswordResetIn(Schema):
    email: str


class PasswordResetConfirmIn(Schema):
    email: str
    code: str
    password: str


class MessageOut(Schema):
    message: str


class UserOut(Schema):
    email: str
    phone: str
