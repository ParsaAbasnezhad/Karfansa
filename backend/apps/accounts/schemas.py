from datetime import datetime

from ninja import Schema
from pydantic import Field


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


class ProfileOut(UserOut):
    first_name: str
    last_name: str
    date_joined: datetime
    province_id: int | None
    province_name: str | None
    city_id: int | None
    city_name: str | None


class ProfileUpdateIn(Schema):
    first_name: str = Field(min_length=1, max_length=150)
    last_name: str = Field(min_length=1, max_length=150)
    province_id: int = Field(gt=0)
    city_id: int = Field(gt=0)
