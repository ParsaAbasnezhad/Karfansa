import pytest
from django.contrib.auth.models import Permission
from django.core.cache import cache
from django.urls import reverse

from apps.accounts.models import User
from apps.core.admin_dashboard import _build_dashboard
from apps.organizations.models import BusinessAuditLog
from apps.services.models import ProductListing, SellerProfile, ServiceCategory
from tests.factories import province

pytestmark = pytest.mark.django_db


def _pending_listing() -> ProductListing:
    user = User.objects.create_user(
        email="moderation-seller@example.com",
        phone="09120000001",
        first_name="فروشنده",
        last_name="آزمایشی",
    )
    seller = SellerProfile.objects.create(
        user=user,
        display_name="فروشنده آزمایشی",
        province=province("tehran"),
    )
    category, _ = ServiceCategory.objects.get_or_create(
        slug="admin-test", defaults={"name": "آزمایشی"}
    )
    listing = ProductListing.objects.create(
        seller=seller,
        category=category,
        province=province("tehran"),
        title="محصول در انتظار بررسی",
        description="شرح محصول آزمایشی برای بررسی مدیر.",
        quantity=1,
        unit="عدد",
    )
    listing.transition_to(ProductListing.Status.PENDING_REVIEW)
    return listing


def test_listing_rejection_requires_moderation_permission_and_is_audited(client):
    listing = _pending_listing()
    staff = User.objects.create_user(
        email="admin@example.com",
        phone="09120000002",
        is_staff=True,
    )
    change_permission = Permission.objects.get(
        content_type__app_label="services",
        codename="change_productlisting",
    )
    staff.user_permissions.add(change_permission)
    client.force_login(staff)
    changelist = reverse("admin:services_productlisting_changelist")
    action_data = {
        "action": "reject_listings",
        "index": "0",
        "select_across": "0",
        "_selected_action": str(listing.pk),
        "rejection_reason": "لطفاً اطلاعات محصول را تکمیل کنید.",
    }

    client.post(changelist, action_data)
    listing.refresh_from_db()
    assert listing.status == ProductListing.Status.PENDING_REVIEW

    moderation_permission = Permission.objects.get(
        content_type__app_label="services",
        codename="moderate_productlisting",
    )
    staff.user_permissions.add(moderation_permission)
    staff = User.objects.get(pk=staff.pk)
    client.force_login(staff)
    client.post(changelist, action_data)

    listing.refresh_from_db()
    assert listing.status == ProductListing.Status.REJECTED
    assert listing.rejection_reason == "لطفاً اطلاعات محصول را تکمیل کنید."
    assert BusinessAuditLog.objects.filter(
        actor=staff,
        action="listing.rejected",
        target_id=str(listing.pk),
    ).exists()


def test_dashboard_analytics_include_real_counts_and_chart_series():
    cache.clear()
    _pending_listing()

    dashboard = _build_dashboard()
    cards = {card["label"]: card["value"] for card in dashboard["cards"]}

    assert cards["کل کاربران"] == User.objects.count()
    assert cards["در انتظار بررسی محصول"] == 1
    assert len(dashboard["charts"]["users"]["labels"]) == 12
    assert len(dashboard["charts"]["users"]["values"]) == 12
    assert len(dashboard["charts"]["product_status"]["values"]) == len(
        ProductListing.Status.choices
    )


def test_admin_dashboard_requires_view_permissions_for_analytics(client):
    staff = User.objects.create_user(
        email="limited-admin@example.com",
        phone="09120000003",
        is_staff=True,
    )
    client.force_login(staff)
    response = client.get(reverse("admin:index"))

    assert response.status_code == 200
    assert b"chart.umd.min.js" not in response.content
    assert b"ka-dashboard-data" not in response.content

    administrator = User.objects.create_user(
        email="super-admin@example.com",
        phone="09120000004",
        is_staff=True,
        is_superuser=True,
    )
    client.force_login(administrator)
    response = client.get(reverse("admin:index"))

    assert response.status_code == 200
    assert b"chart.umd.min.js" in response.content
    assert b'data-chart="users"' in response.content
    assert b'dir="rtl"' in response.content
    assert b"karfansa-admin.css" in response.content
