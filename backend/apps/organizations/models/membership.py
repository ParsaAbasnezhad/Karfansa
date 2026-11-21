from django.conf import settings
from django.db import models

from apps.core.models import UUIDTimeStampedModel


class MemberRole(models.TextChoices):
    OWNER = "owner", "مالک"
    ADMIN = "admin", "مدیر"
    MANAGER = "manager", "کارشناس"
    MEMBER = "member", "عضو"


class MembershipStatus(models.TextChoices):
    ACTIVE = "active", "فعال"
    INVITED = "invited", "دعوت‌شده"
    SUSPENDED = "suspended", "معلق"
    REMOVED = "removed", "حذف‌شده"


class InvitationStatus(models.TextChoices):
    NONE = "none", "بدون دعوت"
    PENDING = "pending", "در انتظار پذیرش"
    ACCEPTED = "accepted", "پذیرفته‌شده"
    DECLINED = "declined", "ردشده"


PUBLISH_ROLES = frozenset({MemberRole.OWNER, MemberRole.ADMIN, MemberRole.MANAGER})
PROFILE_ROLES = PUBLISH_ROLES
VERIFICATION_ROLES = frozenset({MemberRole.OWNER, MemberRole.ADMIN})
MEMBER_ADMIN_ROLES = VERIFICATION_ROLES
INQUIRY_ROLES = frozenset(
    {MemberRole.OWNER, MemberRole.ADMIN, MemberRole.MANAGER, MemberRole.MEMBER}
)


class OrganizationMember(UUIDTimeStampedModel):
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="memberships",
        verbose_name="شرکت",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="organization_memberships",
        verbose_name="کاربر",
    )
    role = models.CharField(max_length=16, choices=MemberRole.choices, verbose_name="نقش")
    status = models.CharField(
        max_length=16,
        choices=MembershipStatus.choices,
        default=MembershipStatus.INVITED,
        verbose_name="وضعیت عضویت",
    )
    invitation_status = models.CharField(
        max_length=16,
        choices=InvitationStatus.choices,
        default=InvitationStatus.NONE,
        verbose_name="وضعیت دعوت",
    )

    class Meta:
        verbose_name = "عضو شرکت"
        verbose_name_plural = "اعضای شرکت"
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "user"],
                name="org_member_user_unique",
            ),
        ]
        indexes = [
            models.Index(fields=["user", "status"], name="org_member_user_status_idx"),
            models.Index(fields=["organization", "role"], name="org_member_role_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.user} · {self.organization} · {self.role}"

    def save(self, *args: object, **kwargs: object) -> None:
        super().save(*args, **kwargs)
        from apps.organizations.access import sync_trade_members

        sync_trade_members(self.organization)

    def delete(self, *args: object, **kwargs: object) -> tuple[int, dict[str, int]]:
        organization = self.organization
        result = super().delete(*args, **kwargs)
        from apps.organizations.access import sync_trade_members

        sync_trade_members(organization)
        return result
