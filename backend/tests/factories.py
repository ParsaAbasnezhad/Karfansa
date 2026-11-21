"""Tiny test data builders (no extra dependency). Each accepts field overrides."""

import itertools
from typing import Any

from apps.advertising.models import Advertisement
from apps.geography.models import Province
from apps.organizations.models import Industry, Organization
from apps.transportation.models import TransportCompany

_counter = itertools.count(1)


def make_organization(**fields: Any) -> Organization:
    n = next(_counter)
    fields.setdefault("name", f"Company {n}")
    return Organization.objects.create(**fields)


def make_industry(**fields: Any) -> Industry:
    n = next(_counter)
    fields.setdefault("name_fa", f"Industry {n}")
    fields.setdefault("slug", f"industry-{n}")
    return Industry.objects.create(**fields)


def make_transport_company(**fields: Any) -> TransportCompany:
    n = next(_counter)
    fields.setdefault("name", f"Carrier {n}")
    return TransportCompany.objects.create(**fields)


def make_advertisement(organization: Organization, **fields: Any) -> Advertisement:
    n = next(_counter)
    fields.setdefault("title", f"Ad {n}")
    fields.setdefault("image", "advertising/test.png")
    fields.setdefault("target_url", "https://example.com/offer")
    return Advertisement.objects.create(organization=organization, **fields)


def province(slug: str) -> Province:
    """A seeded province, for example ``province("tehran")``."""
    return Province.objects.get(slug=slug)
