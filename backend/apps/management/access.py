"""Public helpers for Control Center eligibility checks outside management sessions."""

from django.contrib.auth.models import AbstractBaseUser


def has_control_center_access(user: AbstractBaseUser | None) -> bool:
    """Return whether the public account page may offer Control Center entry.

    Backend login remains the security boundary. This flag is UX-only and must
    stay aligned with management authentication eligibility:
    active staff, non-suspended AdminProfile (or Superuser without a profile yet).
    """
    if user is None or not getattr(user, "is_authenticated", False):
        return False
    if not user.is_active or not user.is_staff:
        return False
    profile = getattr(user, "management_profile", None)
    if profile is not None and profile.suspended:
        return False
    if user.is_superuser:
        return True
    return profile is not None
