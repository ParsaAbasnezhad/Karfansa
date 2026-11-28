from datetime import datetime

from ninja import Schema


class UserRow(Schema):
    id: int
    email: str
    phone: str
    first_name: str
    last_name: str
    is_active: bool
    is_staff: bool
    is_superuser: bool
    date_joined: datetime
    mfa_confirmed: bool
    suspended: bool
    role_ids: list[int]
    individual_action_codes: list[str] = []


class UserListOut(Schema):
    items: list[UserRow]
    total: int
    limit: int
    offset: int


class UserCreateIn(Schema):
    email: str
    phone: str
    first_name: str = ""
    last_name: str = ""
    administrator: bool = False


class UserCreateOut(Schema):
    user: UserRow
    enrollment_code: str | None


class UserUpdateIn(Schema):
    first_name: str
    last_name: str


class RoleOut(Schema):
    id: int
    name: str
    description: str
    action_codes: list[str]
    is_active: bool


class RoleListOut(Schema):
    items: list[RoleOut]
    total: int


class RoleIn(Schema):
    name: str
    description: str = ""
    action_codes: list[str]
    is_active: bool = True


class RoleAssignmentsIn(Schema):
    role_ids: list[int]


class DjangoGroupOut(Schema):
    id: int
    name: str
    permission_ids: list[int]
    permission_labels: list[str]
    member_count: int
    member_ids: list[int] = []
    members_truncated: bool = False


class DjangoGroupListOut(Schema):
    items: list[DjangoGroupOut]
    total: int


class DjangoGroupIn(Schema):
    name: str
    permission_ids: list[int]


class GroupMembersIn(Schema):
    user_ids: list[int]


class DjangoPermissionOption(Schema):
    id: int
    code: str
    label: str
    group: str


class IndividualPermissionsIn(Schema):
    action_codes: list[str]


class ObjectGrantIn(Schema):
    actions: list[str]


class ObjectGrantOut(Schema):
    id: int
    app_label: str
    model_name: str
    object_id: str
    actions: list[str]


class ObjectGrantListOut(Schema):
    items: list[ObjectGrantOut]
    total: int
    limit: int
    offset: int


class PermissionOption(Schema):
    code: str
    label: str
    group: str


class SessionOut(Schema):
    id: int
    created_at: datetime
    last_seen_at: datetime
    expires_at: datetime
    revoked_at: datetime | None
    ip_address: str | None
    user_agent: str


class SessionListOut(Schema):
    items: list[SessionOut]


class AuditOut(Schema):
    id: int
    actor_id: int | None
    action: str
    target_app: str
    target_model: str
    target_id: str
    result: str
    request_id: str
    ip_address: str | None
    user_agent: str
    safe_changes: dict
    created_at: datetime


class AuditListOut(Schema):
    items: list[AuditOut]
    total: int
    limit: int
    offset: int


class MessageOut(Schema):
    message: str


class BulkResourceIn(Schema):
    ids: list[str]
    action: str
    reason: str = ""


class BulkResourceOut(Schema):
    processed: int
    ids: list[str]
