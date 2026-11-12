from decimal import Decimal
from io import BytesIO

import pytest
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, override_settings
from PIL import Image

from apps.accounts.models import User
from apps.services.integrations import sync_product_opportunity
from apps.services.models import (
    ProductInquiry,
    ProductListing,
    SellerProfile,
    ServiceCategory,
)
from tests.factories import province

pytestmark = pytest.mark.django_db


def make_user(n: int = 1) -> User:
    return User.objects.create_user(
        email=f"seller-{n}@example.com",
        password="test-password-123",
        phone=f"091200000{n:02}",
        first_name="فروشنده",
        last_name=str(n),
    )


def make_category() -> ServiceCategory:
    category, _ = ServiceCategory.objects.get_or_create(
        slug="agriculture", defaults={"name": "کشاورزی"}
    )
    return category


def make_profile(user: User, **fields: object) -> SellerProfile:
    return SellerProfile.objects.create(
        user=user,
        display_name="فروشنده مستقل",
        province=province("tehran"),
        **fields,
    )


def make_listing(
    seller: SellerProfile,
    *,
    category: ServiceCategory | None = None,
    status: str = ProductListing.Status.APPROVED,
    title: str = "گندم تجاري ۱۲ تن",
    sale_mode: str = ProductListing.SaleMode.BOTH,
    price: Decimal = Decimal("125000"),
) -> ProductListing:
    listing = ProductListing.objects.create(
        seller=seller,
        category=category or make_category(),
        province=province("tehran"),
        title=title,
        description="گندم باکیفیت برای فروش مستقیم از تولیدکننده",
        sale_mode=sale_mode,
        quantity=Decimal("100"),
        unit="تن",
        price=price,
        currency="IRR",
    )
    if status != ProductListing.Status.DRAFT:
        listing.transition_to(ProductListing.Status.PENDING_REVIEW)
        if status != ProductListing.Status.PENDING_REVIEW:
            listing.transition_to(status)
    return listing


def listing_payload(category: ServiceCategory) -> dict[str, object]:
    return {
        "category_id": category.pk,
        "province_id": province("tehran").pk,
        "title": "خرمای صادراتی",
        "description": "خرمای مرغوب تولیدشده در باغ خانوادگی.",
        "sale_mode": "export",
        "quantity": "500",
        "unit": "کیلوگرم",
        "price": "250000",
        "currency": "IRR",
        "minimum_order_quantity": "10",
        "quality": "درجه یک",
        "packaging": "کارتن",
        "specifications": [{"name": "نوع", "value": "مضافتی"}],
        "submit_for_review": True,
    }


def test_public_listing_search_normalizes_arabic_letters_digits_and_halfspaces(
    client: Client,
) -> None:
    profile = make_profile(make_user())
    listing = make_listing(profile)

    response = client.get(
        "/api/v1/services/listings/?q=گندم%20تجاری%201۲"  # noqa: RUF001
    )

    assert response.status_code == 200
    assert [item["id"] for item in response.json()["results"]] == [listing.pk]
    assert client.get("/api/v1/services/listings/?q=ا").json()["count"] == 0  # noqa: RUF001


def test_parent_category_filter_includes_child_categories(client: Client) -> None:
    parent = make_category()
    child, _ = ServiceCategory.objects.get_or_create(
        slug="test-grains",
        defaults={"name": "غلات", "parent": parent},
    )
    listing = make_listing(make_profile(make_user()), category=child)

    response = client.get("/api/v1/services/listings/?category=agriculture")

    assert response.status_code == 200
    assert [item["id"] for item in response.json()["results"]] == [listing.pk]


def test_only_approved_active_public_seller_listings_are_public(client: Client) -> None:
    public_profile = make_profile(make_user(1))
    approved = make_listing(public_profile)
    pending = make_listing(
        public_profile,
        status=ProductListing.Status.PENDING_REVIEW,
        title="جو در انتظار بررسی",
    )
    hidden_profile = make_profile(make_user(2), is_public=False)
    hidden = make_listing(hidden_profile, title="محصول خصوصی")

    response = client.get("/api/v1/services/listings/")
    assert response.status_code == 200
    assert [item["id"] for item in response.json()["results"]] == [approved.pk]
    assert pending.pk not in {item["id"] for item in response.json()["results"]}
    assert hidden.pk not in {item["id"] for item in response.json()["results"]}
    assert client.get(f"/api/v1/services/listings/{pending.slug}").status_code == 404


def test_listing_filters_cover_category_location_sale_mode_price_and_quantity(
    client: Client,
) -> None:
    profile = make_profile(make_user())
    product = make_listing(profile)

    response = client.get(
        "/api/v1/services/listings/?category=agriculture&province=tehran"
        "&export=true&domestic=true&min_price=100000&max_quantity=200"
    )
    assert response.status_code == 200
    assert [item["id"] for item in response.json()["results"]] == [product.pk]

    assert client.get("/api/v1/services/listings/?min_price=200000").json()["count"] == 0
    assert client.get("/api/v1/services/listings/?export=true&domestic=false").json()["count"] == 0


def test_individual_seller_can_create_listing_without_an_organization(client: Client) -> None:
    user = make_user()
    category = make_category()
    client.force_login(user)

    profile = client.put(
        "/api/v1/services/seller/profile",
        {
            "display_name": "کشاورز نمونه",
            "bio": "تولیدکننده محصولات محلی",
            "province_id": province("tehran").pk,
            "city_id": None,
            "is_public": True,
        },
        content_type="application/json",
    )
    assert profile.status_code == 200

    response = client.post(
        "/api/v1/services/my/listings",
        listing_payload(category),
        content_type="application/json",
    )
    assert response.status_code == 201
    listing = ProductListing.objects.get(pk=response.json()["id"])
    assert listing.seller.user_id == user.pk
    assert listing.status == ProductListing.Status.PENDING_REVIEW
    assert listing.specifications.get(name="نوع").value == "مضافتی"


def test_approved_service_product_is_published_in_province_opportunities(client: Client) -> None:
    user = make_user()
    category = make_category()
    make_profile(user)
    client.force_login(user)

    response = client.post(
        "/api/v1/services/my/listings",
        listing_payload(category),
        content_type="application/json",
    )
    assert response.status_code == 201
    listing = ProductListing.objects.get(pk=response.json()["id"])
    opportunity = listing.trade_opportunity
    assert opportunity.review_status == "pending"
    assert not opportunity.is_published
    assert client.get("/api/v1/trade/opportunities/?province=tehran").json()["count"] == 0

    listing.transition_to(ProductListing.Status.APPROVED, reviewer=user)
    sync_product_opportunity(listing, reviewer=user)

    response = client.get("/api/v1/trade/opportunities/?province=tehran")
    assert response.status_code == 200
    result = next(
        item for item in response.json()["results"] if item["service_listing_slug"] == listing.slug
    )
    assert result["title"] == listing.title
    assert result["product_name_fa"] == listing.title
    assert result["required_volume"] == "500.0000"


def test_seller_edits_to_approved_listing_return_it_to_moderation(client: Client) -> None:
    user = make_user()
    listing = make_listing(make_profile(user))
    client.force_login(user)

    response = client.put(
        f"/api/v1/services/my/listings/{listing.pk}",
        listing_payload(listing.category),
        content_type="application/json",
    )

    assert response.status_code == 200
    listing.refresh_from_db()
    assert listing.status == ProductListing.Status.PENDING_REVIEW
    assert client.get(f"/api/v1/services/listings/{listing.slug}").status_code == 404


def test_listing_ownership_and_moderation_transitions_are_enforced(client: Client) -> None:
    owner = make_user(1)
    other_user = make_user(2)
    listing = make_listing(make_profile(owner))
    make_profile(other_user)

    with pytest.raises(ValidationError):
        listing.status = ProductListing.Status.REJECTED
        listing.save()

    client.force_login(other_user)
    update = client.put(
        f"/api/v1/services/my/listings/{listing.pk}",
        listing_payload(listing.category),
        content_type="application/json",
    )
    assert update.status_code == 404
    archive = client.post(f"/api/v1/services/my/listings/{listing.pk}/archive")
    assert archive.status_code == 404

    listing.refresh_from_db()
    listing.transition_to(ProductListing.Status.ARCHIVED)
    listing.transition_to(ProductListing.Status.DRAFT)
    with pytest.raises(ValidationError):
        listing.transition_to(ProductListing.Status.APPROVED)


def test_inquiry_is_private_and_only_listing_owner_can_manage_it(client: Client) -> None:
    seller = make_user(1)
    buyer = make_user(2)
    listing = make_listing(make_profile(seller))
    make_profile(buyer)
    client.force_login(buyer)
    response = client.post(
        f"/api/v1/services/listings/{listing.slug}/inquiries",
        {"message": "برای خرید این محصول لطفاً تماس بگیرید.", "quantity": "20"},
        content_type="application/json",
    )
    assert response.status_code == 201
    inquiry = ProductInquiry.objects.get(pk=response.json()["id"])
    assert inquiry.buyer_id == buyer.pk

    client.force_login(seller)
    received = client.get("/api/v1/services/inquiries/received")
    assert received.status_code == 200
    assert [item["id"] for item in received.json()] == [inquiry.pk]
    marked_read = client.patch(
        f"/api/v1/services/inquiries/{inquiry.pk}",
        {"status": "read"},
        content_type="application/json",
    )
    assert marked_read.status_code == 200

    client.force_login(buyer)
    forbidden = client.patch(
        f"/api/v1/services/inquiries/{inquiry.pk}",
        {"status": "replied"},
        content_type="application/json",
    )
    assert forbidden.status_code == 404
    submitted = client.get("/api/v1/services/inquiries/submitted")
    assert [item["id"] for item in submitted.json()] == [inquiry.pk]


def test_public_seller_response_does_not_expose_contact_information(client: Client) -> None:
    profile = make_profile(make_user())
    response = client.get(f"/api/v1/services/sellers/{profile.pk}")

    assert response.status_code == 200
    assert "email" not in response.json()
    assert "phone" not in response.json()


def test_image_upload_uses_owner_permissions_and_sends_approved_listing_to_review(
    client: Client, tmp_path
) -> None:
    seller = make_user(1)
    listing = make_listing(make_profile(seller))
    image_buffer = BytesIO()
    Image.new("RGB", (4, 4), color="red").save(image_buffer, format="JPEG")
    image_buffer.seek(0)
    image_file = SimpleUploadedFile("wheat.jpg", image_buffer.read(), content_type="image/jpeg")

    with override_settings(MEDIA_ROOT=tmp_path):
        client.force_login(seller)
        response = client.post(
            f"/api/v1/services/my/listings/{listing.pk}/images",
            {"file": image_file, "alt_text": "محصول"},
        )

    assert response.status_code == 201
    listing.refresh_from_db()
    assert listing.status == ProductListing.Status.PENDING_REVIEW
    assert listing.images.count() == 1
