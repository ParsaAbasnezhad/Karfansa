"""Finite, reviewed registry of records exposed to the management console.

The writable fields below are an allowlist. In particular, credentials, file
paths, moderation state and internal audit records cannot be mass assigned.
"""

from dataclasses import dataclass

from django.apps import apps
from django.db.models import Model


@dataclass(frozen=True)
class ActionSpec:
    key: str
    label: str
    permission: str
    tone: str = "default"
    requires_reason: bool = False


@dataclass(frozen=True)
class ResourceSpec:
    slug: str
    title: str
    group: str
    list_fields: tuple[str, ...]
    search_fields: tuple[str, ...] = ()
    filter_fields: tuple[str, ...] = ()
    writable_fields: tuple[str, ...] = ()
    detail_fields: tuple[str, ...] = ()
    actions: tuple[ActionSpec, ...] = ()
    write_only_fields: tuple[str, ...] = ()
    writable_many_to_many: tuple[str, ...] = ()
    allow_create: bool = True
    allow_delete: bool = False
    sensitive: bool = False

    @property
    def model(self) -> type[Model]:
        app_label, model_name = self.slug.split(".", 1)
        return apps.get_model(app_label, model_name)

    @property
    def exposed_fields(self) -> tuple[str, ...]:
        return tuple(dict.fromkeys((
            "id", *self.list_fields, *self.detail_fields,
            *self.writable_fields, *self.writable_many_to_many,
        )))


def _r(
    slug: str,
    title: str,
    group: str,
    listing: str,
    search: str = "",
    filters: str = "",
    writable: str = "",
    details: str = "",
    *,
    actions: tuple[ActionSpec, ...] = (),
    write_only: str = "",
    many_to_many: str = "",
    create: bool = True,
    delete: bool = False,
    sensitive: bool = False,
) -> ResourceSpec:
    split = lambda value: tuple(value.split())  # noqa: E731
    return ResourceSpec(
        slug=slug,
        title=title,
        group=group,
        list_fields=split(listing),
        search_fields=split(search),
        filter_fields=split(filters),
        writable_fields=split(writable),
        detail_fields=split(details),
        actions=actions,
        write_only_fields=split(write_only),
        writable_many_to_many=split(many_to_many),
        allow_create=create,
        allow_delete=delete,
        sensitive=sensitive,
    )


ORG_ACTIONS = (
    ActionSpec("approve", "تأیید", "approve"),
    ActionSpec("reject", "رد", "reject", "danger", True),
    ActionSpec("suspend", "تعلیق", "unpublish", "danger"),
    ActionSpec("reactivate", "فعال‌سازی", "publish"),
)
LISTING_ACTIONS = (
    ActionSpec("approve", "تأیید و انتشار", "approve"),
    ActionSpec("reject", "رد", "reject", "danger", True),
    ActionSpec("request_changes", "درخواست اصلاح", "reject", "warning", True),
    ActionSpec("unpublish", "لغو انتشار", "unpublish", "warning"),
)
TRADE_ACTIONS = (
    ActionSpec("approve_publish", "تأیید و انتشار", "approve"),
    ActionSpec("approve_only", "تأیید بدون انتشار", "approve"),
    ActionSpec("reject", "رد", "reject", "danger", True),
    ActionSpec("request_changes", "درخواست اصلاح", "reject", "warning", True),
    ActionSpec("unpublish", "لغو انتشار", "unpublish", "warning"),
    ActionSpec("expire", "پایان اعتبار", "unpublish", "warning"),
)
TICKET_ACTIONS = (
    ActionSpec("in_progress", "در حال بررسی", "update"),
    ActionSpec("waiting_for_user", "در انتظار کاربر", "update"),
    ActionSpec("closed", "بستن", "update", "warning"),
)


RESOURCES = (
    _r("auth.group", "گروه‌های دسترسی", "security", "name", "name", writable="name", create=False),
    _r("accounts.user", "کاربران", "users", "email phone first_name last_name is_active is_staff date_joined", "email phone first_name last_name", "province", "first_name last_name province city", "province city last_login", create=False, sensitive=True),
    _r("contact.contactmessage", "پیام‌های تماس", "support", "name subject email is_read created_at", "name email subject message", "is_read created_at", "is_read", "phone message", create=False, sensitive=True),
    _r("home.slide", "اسلایدرها", "content", "title is_active created_at", "title short_text", "is_active", "title short_text description is_active", "image updated_at"),
    _r("home.aboutpagecontent", "محتوای درباره ما", "content", "hero_title updated_at", "hero_title", writable="hero_title hero_intro story_title story_body mission_title mission_body vision_title vision_body", create=False),
    _r("intents.userintent", "اهداف کاربران", "analytics", "user goals follow_up_status created_at", "contact_phone admin_note", "follow_up_status created_at", "follow_up_status admin_note", "contact_phone contact_consent consent_at", create=False, sensitive=True),
    _r("analysis.analysiscategory", "دسته‌بندی گزارش‌ها", "analysis", "name slug display_order", "name slug description", writable="name slug description display_order", delete=True),
    _r("analysis.analysisauthor", "نویسندگان", "analysis", "full_name position", "full_name position", writable="full_name position biography", details="profile_image", delete=True),
    _r("analysis.analysisreport", "گزارش‌ها و مقالات", "analysis", "title status category author published_at is_featured", "title short_description content", "status category author is_featured", "title slug short_description content category report_type author published_at status is_featured seo_title seo_description", "cover_image view_count download_count created_at updated_at"),
    _r("analysis.analysisattachment", "پیوست‌های گزارش", "analysis", "report original_filename file_type file_size created_at", "original_filename report__title", "file_type", "", "download_count", create=False, sensitive=True),
    _r("advertising.advertisement", "آگهی‌های تبلیغاتی", "content", "title organization status start_at end_at", "title description organization__name", "status organization", "organization title slug description target_url start_at end_at", "image rejection_reason created_via published_at created_at updated_at", actions=(ActionSpec("publish", "انتشار", "publish"), ActionSpec("unpublish", "لغو انتشار", "unpublish", "warning"), ActionSpec("reject", "رد", "reject", "danger", True))),
    _r("geography.country", "کشورها", "geography", "name_fa name_en iso2", "name_fa name_en iso2", writable="name_fa name_en iso2", delete=True),
    _r("geography.province", "استان‌ها", "geography", "name_fa name_en capital is_published country", "name_fa name_en slug country__name_fa country__iso2 capital__name_fa", "country is_published", "country name_fa name_en slug capital short_description description economic_description area_sq_km population latitude longitude is_published", "featured_image map_image created_at updated_at", delete=True),
    _r("geography.provinceindustry", "صنایع استان", "geography", "province industry activity_level production_capacity updated_year", "province__name_fa industry__name_fa industry__name_en province__name_en description competitive_advantage source", "province industry activity_level industry__category province__country", "province industry description activity_level production_capacity production_capacity_unit competitive_advantage source source_url updated_year", delete=True, many_to_many="active_cities"),
    _r("geography.provincestatistics", "آمار استان", "geography", "province indicator value statistical_year validation_status", "indicator item_label", "province category validation_status statistical_year", "province indicator category value value_text item_label unit statistical_year period period_number source source_url source_published_at collected_at notes validation_status", delete=True),
    _r("geography.city", "شهرها", "geography", "name_fa name_en province is_county_center country_name", "name_fa name_en slug province__name_fa province__country__name_fa", "province province__country is_county_center", "province name_fa name_en slug population description is_county_center latitude longitude", delete=True),
    _r("organizations.industry", "صنایع", "organizations", "name_fa name_en category is_published", "name_fa name_en slug", "category is_published", "name_fa name_en slug description category is_published", "image", delete=True, many_to_many="products"),
    _r("organizations.product", "محصولات پایه", "organizations", "name_fa name_en slug", "name_fa name_en slug", writable="name_fa name_en slug description", delete=True),
    _r("organizations.organization", "شرکت‌ها و سازمان‌ها", "organizations", "name organization_type verification_status is_active province created_at", "name english_name national_id registration_number email phone", "verification_status organization_type industry province is_active", "name english_name organization_type description established_at industry country province city address postal_code phone mobile email website whatsapp telegram linkedin instagram ceo_name representative_name representative_phone", "logo cover_image national_id registration_number economic_code rejection_reason submitted_at reviewed_at reviewed_by is_verified updated_at", actions=ORG_ACTIONS, create=False, sensitive=True),
    _r("organizations.organizationmember", "اعضای شرکت", "organizations", "organization user role status invitation_status created_at", "organization__name user__email", "role status invitation_status", "organization user role status invitation_status", "updated_at", create=False, sensitive=True),
    _r("organizations.verificationdocument", "مدارک اعتبارسنجی", "organizations", "document_type object_id review_status uploaded_by created_at", "object_id uploaded_by__email", "document_type review_status", "", "content_type reviewer reviewed_at rejection_reason", actions=(ActionSpec("approve", "تأیید مدرک", "approve"), ActionSpec("reject", "رد مدرک", "reject", "danger", True)), create=False, sensitive=True),
    _r("organizations.businessauditlog", "رویدادهای تجاری", "audit", "action target_type target_id actor created_at", "action target_id", "action target_type", "", "metadata", create=False, sensitive=True),
    _r("trade.tradeopportunity", "فرصت‌های تجاری", "trade", "title opportunity_type review_status is_published province created_at", "title description target_market company__name", "review_status is_published opportunity_type opportunity_level province", "title province city product industry opportunity_level opportunity_type description target_market required_volume volume_unit min_value max_value currency company source source_url valid_until relevance_score", "created_by published_at scheduled_for rejection_reason last_reviewed_at last_reviewed_by updated_at", actions=TRADE_ACTIONS),
    _r("services.sellerprofile", "کسب‌وکارهای فردی", "services", "display_name user verification_status is_public province created_at", "display_name user__email professional_title", "verification_status is_public province", "display_name bio professional_title public_phone public_email province city is_public", "profile_image cover_image rejection_reason submitted_at reviewed_at reviewed_by updated_at", actions=ORG_ACTIONS, create=False, sensitive=True),
    _r("services.servicecategory", "دسته‌بندی خدمات", "services", "name parent is_active sort_order", "name slug", "parent is_active", "name slug description parent is_active sort_order", delete=True),
    _r("services.productlisting", "محصولات و خدمات", "services", "title seller listing_kind category status is_active created_at", "title description seller__display_name organization__name", "status listing_kind category province is_active", "seller organization listing_kind category province city title description sale_mode quantity unit price currency is_price_negotiable minimum_order_quantity quality packaging", "slug rejection_reason published_at reviewed_at reviewed_by updated_at", actions=LISTING_ACTIONS),
    _r("services.listingimage", "تصاویر آگهی", "services", "listing alt_text sort_order created_at", "listing__title alt_text", writable="listing alt_text sort_order", details="image", create=False),
    _r("services.productspecification", "ویژگی‌های محصول", "services", "listing name value sort_order", "listing__title name value", writable="listing name value sort_order", delete=True),
    _r("services.productinquiry", "استعلام‌ها", "inquiries", "subject listing buyer status created_at", "subject buyer__email listing__title", "status category", "status", "message quantity last_activity_at owner_organization owner_seller owner_user", create=False, sensitive=True),
    _r("support.supportticket", "درخواست‌های پشتیبانی", "support", "ticket_number subject user priority status created_at", "ticket_number subject contact_email", "status priority category assigned_to", "assigned_to priority", "contact_name contact_email contact_phone last_message_at closed_at", actions=TICKET_ACTIONS, create=False, sensitive=True),
    _r("support.ticketmessage", "پیام‌های پشتیبانی", "support", "ticket sender sender_type is_internal created_at", "message ticket__ticket_number", "sender_type is_internal", "", "message", create=False, sensitive=True),
    _r("transportation.transportmode", "شیوه‌های حمل", "transportation", "name_fa name_en code sort_order", "name_fa name_en code", writable="code name_fa name_en sort_order", delete=True),
    _r("transportation.vehicletype", "نوع وسیله نقلیه", "transportation", "name_fa name_en mode", "name_fa name_en slug", "mode", "slug name_fa name_en mode", delete=True),
    _r("transportation.transportcompany", "شرکت‌های حمل‌ونقل", "transportation", "name province is_verified is_active created_at", "name english_name phone email", "province is_verified is_active", "name english_name description fleet_capacity tracking_available insurance_available customs_services country province city address phone mobile email website whatsapp telegram instagram", "logo cover_image national_id registration_number updated_at", actions=(ActionSpec("verify", "تأیید", "approve"), ActionSpec("suspend", "تعلیق", "unpublish", "danger"), ActionSpec("reactivate", "فعال‌سازی", "publish")), create=False, sensitive=True, many_to_many="transport_types vehicle_types service_provinces origin_countries destination_countries"),
)

RESOURCE_MAP = {resource.slug: resource for resource in RESOURCES}


def get_resource(slug: str) -> ResourceSpec | None:
    return RESOURCE_MAP.get(slug)
