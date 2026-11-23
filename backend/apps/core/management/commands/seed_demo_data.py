"""Populate the local development database with fictional Persian marketplace data."""

from __future__ import annotations

import hashlib
import ipaddress
import os
from collections import Counter
from datetime import timedelta
from decimal import Decimal
from typing import Any

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
from django.utils import timezone

from apps.accounts.models import User
from apps.core.management.demo_catalog import (
    COMPANIES,
    INQUIRIES,
    OPPORTUNITIES,
    PRODUCTS,
    SELLERS,
    SERVICES,
)
from apps.core.management.demo_images import render_demo_image
from apps.core.verification import VerificationStatus
from apps.geography.models import City, Country, Province
from apps.organizations.models import (
    Industry,
    InvitationStatus,
    MemberRole,
    MembershipStatus,
    Organization,
    OrganizationMember,
)
from apps.services.models import (
    ListingImage,
    ProductInquiry,
    ProductListing,
    ProductSpecification,
    SellerProfile,
    ServiceCategory,
)
from apps.trade.models import OpportunityLevel, OpportunityReviewStatus, TradeOpportunity

NAMESPACE = "demo-karfansa"
EMAIL_DOMAIN = "demo.karfansa.invalid"
DEFAULT_PASSWORD = "KarfansaDemo!2026"  # noqa: S105 - local DEBUG-only accounts
BUYER_NAMES = ("نسترن راد", "مانی بهرامی", "الهام نیک‌پی", "پارسا رفیعی")
STREETS = (
    "بلوار پژوهش",
    "خیابان کارآفرین",
    "میدان صنعت",
    "بلوار تعاون",
    "خیابان آفتاب",
    "خیابان پیشگامان",
)
LANDLINE_PREFIX = {
    "فارس": "071",
    "آذربایجان شرقی": "041",
    "تهران": "021",
    "خوزستان": "061",
    "یزد": "035",
    "اصفهان": "031",
    "هرمزگان": "076",
    "خراسان رضوی": "051",
    "البرز": "026",
    "گیلان": "013",
    "کرمان": "034",
    "قزوین": "028",
}


def _slug(code: str) -> str:
    return f"{NAMESPACE}-{code}"


def _email(kind: str, code: str) -> str:
    return f"{NAMESPACE}-{kind}-{code}@{EMAIL_DOMAIN}"


def _phone(index: int) -> str:
    return f"0990000{index:04d}"


class Command(BaseCommand):
    help = "Seed fictional Persian companies, sellers and listings in a local development DB only."

    def add_arguments(self, parser: Any) -> None:
        parser.add_argument(
            "--dry-run", action="store_true", help="Preview counts without writing rows or files."
        )
        parser.add_argument(
            "--demo-password",
            default=os.environ.get("KARFANSA_DEMO_PASSWORD", DEFAULT_PASSWORD),
            help="Password for newly created demo accounts; existing passwords are never changed.",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        self._assert_safe_database()
        self._validate_catalog()
        self.locations = self._load_locations()
        self.stats: Counter[str] = Counter()
        self.created_files: list[tuple[Any, str]] = []
        self.password = str(options["demo_password"])
        if len(self.password) < 12:
            raise CommandError("Demo password must have at least 12 characters.")

        if options["dry_run"]:
            self._print_dry_run()
            return

        try:
            with transaction.atomic():
                self._seed()
        except Exception:
            for storage, name in reversed(self.created_files):
                try:
                    storage.delete(name)
                except Exception as exc:
                    self.stderr.write(f"Could not remove orphaned demo image {name}: {exc}")
            raise

        self.stdout.write(self.style.SUCCESS("Demo data seeding completed."))
        for label in (
            "users",
            "industries",
            "categories",
            "companies",
            "memberships",
            "individuals",
            "products",
            "services",
            "trade_opportunities",
            "inquiries",
            "specifications",
            "images",
        ):
            self.stdout.write(f"  {label}: {self.stats[label]} created")
        self.stdout.write(
            f"Demo login example: {_email('company', COMPANIES[0]['code'])} "
            "(password is the --demo-password value; existing account passwords were not changed)."
        )

    def _assert_safe_database(self) -> None:
        if (
            not settings.DEBUG
            or os.environ.get("DJANGO_SETTINGS_MODULE") != "config.settings.development"
            or os.environ.get("KARFANSA_DEMO_SEED_LOCAL") != "1"
        ):
            raise CommandError(
                "seed_demo_data requires DEBUG=True, development settings "
                "and the local Compose marker."
            )
        database = connection.settings_dict
        host = str(database.get("HOST") or "").lower()
        name = str(database.get("NAME") or "")
        if connection.vendor != "postgresql" or host not in {"db", "localhost", "127.0.0.1", "::1"}:
            raise CommandError("Refusing to seed a non-local PostgreSQL connection.")
        if not name or any(
            word in name.lower() for word in ("prod", "production", "staging", "live")
        ):
            raise CommandError("Refusing to seed a production-like database name.")
        with connection.cursor() as cursor:
            cursor.execute("SELECT current_database(), host(inet_server_addr())")
            actual_name, address = cursor.fetchone()
        if actual_name != name or not address or not ipaddress.ip_address(address).is_private:
            raise CommandError(
                "The connected PostgreSQL server is not a verified local development DB."
            )

    def _validate_catalog(self) -> None:
        for label, entries in (
            ("company", COMPANIES),
            ("seller", SELLERS),
            ("listing", (*PRODUCTS, *SERVICES)),
            ("opportunity", OPPORTUNITIES),
            ("inquiry", INQUIRIES),
        ):
            codes = [entry["code"] for entry in entries]
            if len(codes) != len(set(codes)):
                raise CommandError(f"Duplicate {label} demo code in catalog.")
            if any(len(_slug(code)) > 50 for code in codes):
                raise CommandError(f"A {label} demo code is too long for a model slug.")
        companies = {entry["code"] for entry in COMPANIES}
        sellers = {entry["code"] for entry in SELLERS}
        listings = {entry["code"] for entry in (*PRODUCTS, *SERVICES)}
        for entry in (*PRODUCTS, *SERVICES):
            owners = companies if entry["owner_kind"] == "company" else sellers
            if entry["owner_code"] not in owners:
                raise CommandError(f"Listing {entry['code']} has an unknown owner.")
            if entry["status"] not in {
                ProductListing.Status.APPROVED,
                ProductListing.Status.PENDING_REVIEW,
                ProductListing.Status.REJECTED,
            }:
                raise CommandError(f"Listing {entry['code']} has an invalid status.")
        if any(
            entry["verification_status"] not in VerificationStatus.values for entry in COMPANIES
        ):
            raise CommandError("A company has an invalid verification status.")
        for entry in OPPORTUNITIES:
            if entry["company_code"] not in companies:
                raise CommandError(f"Opportunity {entry['code']} has an unknown company.")
        for entry in INQUIRIES:
            if entry["listing_code"] not in listings or not 0 <= entry["buyer_index"] < len(
                BUYER_NAMES
            ):
                raise CommandError(f"Inquiry {entry['code']} has an invalid listing or buyer.")

    def _load_locations(self) -> dict[tuple[str, str], tuple[Province, City]]:
        country = Country.objects.filter(iso2="IR").first()
        if country is None:
            raise CommandError("Iran geography is missing; apply geography migrations first.")
        result: dict[tuple[str, str], tuple[Province, City]] = {}
        for entry in (*COMPANIES, *SELLERS):
            key = (entry["province"], entry["city"])
            if key in result:
                continue
            province = Province.objects.filter(
                country=country, name_fa=key[0], is_published=True
            ).first()
            city = (
                City.objects.filter(province=province, name_fa=key[1]).first() if province else None
            )
            if province is None or city is None:
                raise CommandError(f"Published province/city not found: {key[0]} / {key[1]}")
            result[key] = province, city
        return result

    def _print_dry_run(self) -> None:
        self.stdout.write("Dry run: no database rows or media files will be written.")
        for label, model, entries in (
            ("companies", Organization, COMPANIES),
            ("products", ProductListing, PRODUCTS),
            ("services", ProductListing, SERVICES),
            ("trade opportunities", TradeOpportunity, OPPORTUNITIES),
        ):
            existing = model.objects.filter(
                slug__in=[_slug(item["code"]) for item in entries]
            ).count()
            self.stdout.write(
                f"  {label}: {len(entries) - existing} missing of {len(entries)} planned"
            )
        seller_emails = [_email("seller", item["code"]) for item in SELLERS]
        existing_sellers = SellerProfile.objects.filter(user__email__in=seller_emails).count()
        missing_sellers = len(SELLERS) - existing_sellers
        self.stdout.write(
            f"  individual profiles: {missing_sellers} missing of {len(SELLERS)} planned"
        )
        existing_inquiries = ProductInquiry.objects.filter(
            buyer__email__endswith=f"@{EMAIL_DOMAIN}",
            message__in=[item["message"] for item in INQUIRIES],
        ).count()
        missing_inquiries = len(INQUIRIES) - existing_inquiries
        self.stdout.write(f"  inquiries: {missing_inquiries} missing of {len(INQUIRIES)} planned")

    def _seed(self) -> None:
        categories = self._categories()
        industries = self._industries()
        companies, company_owners = self._companies(industries)
        sellers = self._sellers()
        buyers = self._buyers()
        listings = self._listings(categories, companies, sellers)
        self._opportunities(companies, company_owners)
        self._inquiries(listings, buyers)

    def _categories(self) -> dict[str, ServiceCategory]:
        result: dict[str, ServiceCategory] = {}
        for name in dict.fromkeys(item["category"] for item in (*PRODUCTS, *SERVICES)):
            existing = ServiceCategory.objects.filter(name=name, is_active=True).first()
            if existing is not None:
                result[name] = existing
                continue
            if ServiceCategory.objects.filter(name=name).exists():
                raise CommandError(f"Existing category is inactive: {name}")
            digest = hashlib.sha1(name.encode()).hexdigest()[:10]  # noqa: S324 - stable ID only
            slug = f"{NAMESPACE}-category-{digest}"
            if ServiceCategory.objects.filter(slug=slug).exists():
                raise CommandError(f"Demo category slug collision: {slug}")
            category = ServiceCategory(
                name=name, slug=slug, description="دسته‌بندی داده نمایشی", is_active=True
            )
            category.full_clean()
            category.save()
            result[name] = category
            self.stats["categories"] += 1
        return result

    def _industries(self) -> dict[str, Industry]:
        result: dict[str, Industry] = {}
        for entry in COMPANIES:
            name = entry["industry_name"]
            if name in result:
                continue
            industry = Industry.objects.filter(name_fa=name).first()
            if industry is None:
                slug = _slug(f"industry-{entry['code']}")
                if Industry.objects.filter(slug=slug).exists():
                    raise CommandError(f"Demo industry slug collision: {slug}")
                industry = Industry(
                    name_fa=name, slug=slug, category=entry["industry_category"], is_published=True
                )
                industry.full_clean()
                industry.save()
                self.stats["industries"] += 1
            result[name] = industry
        return result

    def _user(self, kind: str, code: str, index: int, full_name: str) -> User:
        email = _email(kind, code)
        existing = User.objects.filter(email=email).first()
        phone = _phone(index)
        first_name, _, last_name = full_name.partition(" ")
        if existing is not None:
            if (
                existing.is_staff
                or existing.phone != phone
                or existing.first_name != first_name
                or existing.last_name != last_name
            ):
                raise CommandError(f"Demo user namespace collision: {email}")
            return existing
        if User.objects.filter(phone=phone).exists():
            raise CommandError(f"Demo phone collides with an existing user: {phone}")
        user = User.objects.create_user(
            email=email,
            phone=phone,
            password=self.password,
            first_name=first_name,
            last_name=last_name,
        )
        self.stats["users"] += 1
        return user

    def _save_image(self, instance: Any, field_name: str, kind: str, code: str) -> None:
        field = getattr(instance, field_name)
        content = ContentFile(render_demo_image(kind, f"{field_name}:{code}"))
        field.save(f"{NAMESPACE}-{code}.webp", content, save=False)
        self.created_files.append((field.storage, field.name))
        instance.save(update_fields=[field_name])
        self.stats["images"] += 1

    def _companies(
        self, industries: dict[str, Industry]
    ) -> tuple[dict[str, Organization], dict[str, User]]:
        result: dict[str, Organization] = {}
        owners: dict[str, User] = {}
        country = Country.objects.get(iso2="IR")
        for index, entry in enumerate(COMPANIES, 1):
            code = entry["code"]
            owner = self._user("company", code, index, entry["representative_name"])
            province, city = self.locations[(entry["province"], entry["city"])]
            org = Organization.objects.filter(slug=_slug(code)).first()
            created_org = org is None
            if org is None:
                status = entry["verification_status"]
                now = timezone.now()
                street = STREETS[(index - 1) % len(STREETS)]
                org = Organization(
                    slug=_slug(code),
                    name=entry["name"],
                    organization_type=entry["organization_type"],
                    national_id=f"1400999{index:04d}",
                    registration_number=f"990{index:05d}",
                    economic_code=f"4119999{index:05d}",
                    industry=industries[entry["industry_name"]],
                    country=country,
                    province=province,
                    city=city,
                    description=entry["description"],
                    address=f"{city.name_fa}، {street}، پلاک {index * 7}",
                    phone=f"{LANDLINE_PREFIX[entry['province']]}-{88000000 + index}",
                    email=f"contact-{code}@{EMAIL_DOMAIN}",
                    ceo_name=entry["ceo_name"],
                    representative_name=entry["representative_name"],
                    representative_phone=owner.phone,
                    verification_status=status,
                    is_verified=status == VerificationStatus.VERIFIED,
                    is_active=True,
                    rejection_reason="مدارک ثبتی برای بررسی دوباره نیاز به تکمیل دارند."
                    if status == VerificationStatus.REJECTED
                    else "",
                    submitted_at=now - timedelta(days=index + 2),
                    reviewed_at=now - timedelta(days=index)
                    if status != VerificationStatus.PENDING
                    else None,
                )
                org.full_clean()
                org.save()
                self.stats["companies"] += 1
                self._save_image(org, "logo", "logo", code)
                self._save_image(org, "cover_image", "cover", code)
            elif (
                org.name != entry["name"]
                or org.organization_type != entry["organization_type"]
                or org.national_id != f"1400999{index:04d}"
                or org.registration_number != f"990{index:05d}"
                or org.economic_code != f"4119999{index:05d}"
                or org.province_id != province.pk
                or org.city_id != city.pk
                or org.email != f"contact-{code}@{EMAIL_DOMAIN}"
            ):
                raise CommandError(f"Demo company namespace collision: {code}")
            if created_org:
                OrganizationMember.objects.create(
                    organization=org,
                    user=owner,
                    role=MemberRole.OWNER,
                    status=MembershipStatus.ACTIVE,
                    invitation_status=InvitationStatus.ACCEPTED,
                )
                self.stats["memberships"] += 1
            elif not OrganizationMember.objects.filter(
                organization=org,
                user=owner,
                role=MemberRole.OWNER,
                status=MembershipStatus.ACTIVE,
            ).exists():
                raise CommandError(f"Demo company owner mismatch: {code}")
            result[code] = org
            owners[code] = owner
        return result, owners

    def _sellers(self) -> dict[str, SellerProfile]:
        result: dict[str, SellerProfile] = {}
        for index, entry in enumerate(SELLERS, 1):
            code = entry["code"]
            user = self._user("seller", code, 12 + index, entry["display_name"])
            province, city = self.locations[(entry["province"], entry["city"])]
            profile = SellerProfile.objects.filter(user=user).first()
            if profile is None:
                status = (
                    VerificationStatus.VERIFIED
                    if index <= 6
                    else VerificationStatus.PENDING
                    if index == 7
                    else VerificationStatus.REJECTED
                )
                profile = SellerProfile(
                    user=user,
                    display_name=entry["display_name"],
                    professional_title=entry["professional_title"],
                    bio=entry["bio"],
                    province=province,
                    city=city,
                    public_phone=user.phone,
                    public_email=user.email,
                    is_public=index != 8,
                    verification_status=status,
                    rejection_reason="اطلاعات حرفه‌ای برای بررسی دوباره نیاز به تکمیل دارد."
                    if index == 8
                    else "",
                    submitted_at=timezone.now() - timedelta(days=index + 1),
                )
                profile.full_clean()
                profile.save()
                self.stats["individuals"] += 1
                self._save_image(profile, "profile_image", "avatar", code)
                self._save_image(profile, "cover_image", "cover", f"seller-{code}")
            elif (
                profile.display_name != entry["display_name"]
                or profile.province_id != province.pk
                or profile.city_id != city.pk
            ):
                raise CommandError(f"Demo individual namespace collision: {code}")
            result[code] = profile
        return result

    def _buyers(self) -> list[User]:
        return [
            self._user("buyer", str(index), 20 + index, name)
            for index, name in enumerate(BUYER_NAMES, 1)
        ]

    def _listings(
        self,
        categories: dict[str, ServiceCategory],
        companies: dict[str, Organization],
        sellers: dict[str, SellerProfile],
    ) -> dict[str, ProductListing]:
        result: dict[str, ProductListing] = {}
        for kind, entries in (
            (ProductListing.Kind.PRODUCT, PRODUCTS),
            (ProductListing.Kind.SERVICE, SERVICES),
        ):
            for entry in entries:
                code = entry["code"]
                owner = (
                    companies[entry["owner_code"]]
                    if entry["owner_kind"] == "company"
                    else sellers[entry["owner_code"]]
                )
                listing = ProductListing.objects.filter(slug=_slug(code)).first()
                if listing is None:
                    quantity = Decimal(str(entry["quantity"]))
                    listing = ProductListing(
                        slug=_slug(code),
                        listing_kind=kind,
                        organization=owner if entry["owner_kind"] == "company" else None,
                        seller=owner if entry["owner_kind"] == "seller" else None,
                        category=categories[entry["category"]],
                        province=owner.province,
                        city=owner.city,
                        title=entry["title"],
                        description=entry["description"],
                        sale_mode=entry["sale_mode"],
                        quantity=quantity,
                        unit=entry["unit"],
                        price=Decimal(str(entry["price"])) if entry["price"] is not None else None,
                        currency="IRR",
                        is_price_negotiable=entry["price"] is None,
                        minimum_order_quantity=quantity / 10
                        if kind == ProductListing.Kind.PRODUCT
                        else None,
                        quality=entry["quality"],
                        packaging=entry["packaging"],
                        status=ProductListing.Status.DRAFT,
                        is_active=True,
                    )
                    listing.full_clean()
                    listing.save()
                    listing.transition_to(ProductListing.Status.PENDING_REVIEW)
                    if entry["status"] == "approved":
                        listing.transition_to(ProductListing.Status.APPROVED)
                    elif entry["status"] == "rejected":
                        listing.transition_to(
                            ProductListing.Status.REJECTED,
                            rejection_reason="توضیحات آگهی برای انتشار نیاز به بازبینی دارد.",
                        )
                    self.stats[
                        "products" if kind == ProductListing.Kind.PRODUCT else "services"
                    ] += 1
                    for order, (name, value) in enumerate(
                        (
                            ("ویژگی", entry["quality"]),
                            ("بسته‌بندی یا شیوه ارائه", entry["packaging"]),
                        ),
                    ):
                        if value:
                            ProductSpecification.objects.create(
                                listing=listing,
                                name=name,
                                value=value[:250],
                                sort_order=order,
                            )
                            self.stats["specifications"] += 1
                    picture = ListingImage(
                        listing=listing, alt_text=f"تصویر نمایشی {entry['title']}"
                    )
                    picture.image.save(
                        f"{NAMESPACE}-{code}.webp",
                        ContentFile(render_demo_image("listing", f"{entry['category']}:{code}")),
                        save=False,
                    )
                    self.created_files.append((picture.image.storage, picture.image.name))
                    picture.full_clean()
                    picture.save()
                    self.stats["images"] += 1
                elif (
                    listing.title != entry["title"]
                    or listing.listing_kind != kind
                    or listing.category_id != categories[entry["category"]].pk
                    or listing.organization_id
                    != (owner.pk if entry["owner_kind"] == "company" else None)
                    or listing.seller_id != (owner.pk if entry["owner_kind"] == "seller" else None)
                ):
                    raise CommandError(f"Demo listing namespace collision: {code}")
                result[code] = listing
        return result

    def _opportunities(self, companies: dict[str, Organization], owners: dict[str, User]) -> None:
        levels = list(OpportunityLevel.values)
        for index, entry in enumerate(OPPORTUNITIES):
            existing = TradeOpportunity.objects.filter(slug=_slug(entry["code"])).first()
            if existing is not None:
                if (
                    existing.title != entry["title"]
                    or existing.company_id != companies[entry["company_code"]].pk
                    or existing.created_by_id != owners[entry["company_code"]].pk
                ):
                    raise CommandError(f"Demo opportunity namespace collision: {entry['code']}")
                continue
            company = companies[entry["company_code"]]
            status = entry["status"]
            opportunity = TradeOpportunity(
                slug=_slug(entry["code"]),
                title=entry["title"],
                company=company,
                created_by=owners[entry["company_code"]],
                province=company.province,
                city=company.city,
                industry=company.industry,
                opportunity_type=entry["opportunity_type"],
                opportunity_level=levels[index % len(levels)],
                description=entry["description"],
                target_market=entry["target_market"],
                required_volume=Decimal(str(entry["required_volume"]))
                if entry["required_volume"] is not None
                else None,
                volume_unit=entry["volume_unit"],
                source="فرصت تجاری نمایشی کارفنسا",
                review_status=status,
                is_published=status == OpportunityReviewStatus.APPROVED,
                valid_until=timezone.localdate() + timedelta(days=90 + index * 12),
                relevance_score=65 + index * 3,
            )
            opportunity.full_clean()
            opportunity.save()
            self.stats["trade_opportunities"] += 1

    def _inquiries(self, listings: dict[str, ProductListing], buyers: list[User]) -> None:
        for entry in INQUIRIES:
            listing = listings[entry["listing_code"]]
            buyer = buyers[entry["buyer_index"]]
            if listing.status != ProductListing.Status.APPROVED:
                raise CommandError(f"Inquiry targets a non-public listing: {entry['code']}")
            if ProductInquiry.objects.filter(
                listing=listing, buyer=buyer, message=entry["message"]
            ).exists():
                continue
            inquiry = ProductInquiry(
                listing=listing,
                buyer=buyer,
                message=entry["message"],
                quantity=Decimal(str(entry["quantity"])) if entry["quantity"] is not None else None,
                status=entry["status"],
            )
            inquiry.full_clean()
            inquiry.save()
            self.stats["inquiries"] += 1
