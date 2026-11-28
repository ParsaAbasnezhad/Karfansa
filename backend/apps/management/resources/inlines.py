"""Inline child-resource workflows mirroring Django admin inlines.

The five ModelAdmin inline configurations in Django Admin map to these specs.
A child is always created/updated through the same `save_resource` validation
and permission path as the standalone child resource; the parent foreign key is
forced to the parent record and cannot be reassigned through the inline.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class InlineSpec:
    key: str
    title: str
    parent_slug: str
    child_slug: str
    fk_name: str
    can_add: bool = True
    can_delete: bool = True


INLINES: tuple[InlineSpec, ...] = (
    # geography.ProvinceAdmin.inlines -> ProvinceIndustryInline
    InlineSpec(
        key="provinceindustry",
        title="صنایع استان",
        parent_slug="geography.province",
        child_slug="geography.provinceindustry",
        fk_name="province",
    ),
    # analysis.AnalysisReportAdmin.inlines -> AnalysisAttachmentInline
    InlineSpec(
        key="attachment",
        title="پیوست‌های گزارش",
        parent_slug="analysis.analysisreport",
        child_slug="analysis.analysisattachment",
        fk_name="report",
    ),
    # organizations.OrganizationAdmin.inlines -> OrganizationMemberInline
    InlineSpec(
        key="member",
        title="اعضای سازمان",
        parent_slug="organizations.organization",
        child_slug="organizations.organizationmember",
        fk_name="organization",
    ),
    # services.ProductListingAdmin.inlines -> ListingImageInline
    InlineSpec(
        key="image",
        title="تصاویر آگهی",
        parent_slug="services.productlisting",
        child_slug="services.listingimage",
        fk_name="listing",
    ),
    # services.ProductListingAdmin.inlines -> ProductSpecificationInline
    InlineSpec(
        key="specification",
        title="ویژگی‌های محصول",
        parent_slug="services.productlisting",
        child_slug="services.productspecification",
        fk_name="listing",
    ),
)

_INLINE_MAP = {(item.parent_slug, item.key): item for item in INLINES}


def inlines_for(parent_slug: str) -> tuple[InlineSpec, ...]:
    return tuple(item for item in INLINES if item.parent_slug == parent_slug)


def get_inline(parent_slug: str, key: str) -> InlineSpec | None:
    return _INLINE_MAP.get((parent_slug, key))
