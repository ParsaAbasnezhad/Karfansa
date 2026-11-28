"""Module 1 parity: provinces, cities, province industries + inline workflow."""

from types import SimpleNamespace

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from ninja.errors import HttpError

from apps.geography.models import City, Country, Province, ProvinceIndustry
from apps.management.api import resources
from apps.management.models import AdminProfile
from apps.management.permissions import can_manage
from apps.management.resources.inlines import get_inline
from apps.management.resources.registry import get_resource
from apps.management.resources.selectors import filtered_queryset, serialize_record
from apps.management.resources.services import save_resource
from apps.organizations.models import Industry

pytestmark = pytest.mark.django_db


def _country() -> Country:
    country, _ = Country.objects.get_or_create(iso2="IR", defaults={"name_fa": "ایران", "name_en": "Iran"})
    return country


def _province(country: Country | None = None, slug: str = "test-province-zzz", name_fa: str = "استان آزمون") -> Province:
    return Province.objects.create(country=country or _country(), name_fa=name_fa, name_en="TestProvince", slug=slug)


def _request(actor) -> SimpleNamespace:  # type: ignore[no-untyped-def]
    return SimpleNamespace(META={}, management_actor=actor, management_session={})


def _actor(email: str = "root@example.test", superuser: bool = True):  # type: ignore[no-untyped-def]
    User = get_user_model()
    return User.objects.create_superuser(email=email, password="x", phone="+989120000001") if superuser else User.objects.create_user(email=email, password="x", phone="+989120000001")


# ---------- registry shape ----------

def test_province_and_city_allow_delete_and_expose_full_fields() -> None:
    province = get_resource("geography.province")
    city = get_resource("geography.city")
    assert province and province.allow_delete and province.allow_create
    assert city and city.allow_delete and city.allow_create
    for name in ("country", "name_fa", "name_en", "slug", "capital", "short_description", "description",
                 "economic_description", "area_sq_km", "population", "latitude", "longitude", "is_published"):
        assert name in province.writable_fields
    assert set(province.detail_fields) >= {"featured_image", "map_image", "created_at", "updated_at"}
    for name in ("province", "name_fa", "name_en", "slug", "population", "description", "is_county_center", "latitude", "longitude"):
        assert name in city.writable_fields


def test_province_industry_inline_registered() -> None:
    inline = get_inline("geography.province", "provinceindustry")
    assert inline and inline.child_slug == "geography.provinceindustry" and inline.fk_name == "province"


def test_province_industry_filters_and_search_match_django_admin() -> None:
    spec = get_resource("geography.provinceindustry")
    assert spec
    assert set(spec.filter_fields) >= {"province", "industry", "activity_level", "industry__category", "province__country"}
    assert "active_cities" in spec.writable_many_to_many


def test_city_nested_country_filter_and_computed_country_name(monkeypatch: pytest.MonkeyPatch) -> None:
    spec = get_resource("geography.city")
    assert spec
    assert "province__country" in spec.filter_fields
    monkeypatch.setattr("apps.management.resources.selectors.scope_queryset", lambda request, queryset: queryset)
    province = _province()
    city = City.objects.create(province=province, name_fa="شهر آزمون", name_en="TestCity", slug="testcity-zzz")
    row = serialize_record(city, spec)
    assert row["country_name"] == province.country.name_fa
    qs = filtered_queryset(SimpleNamespace(GET={"province__country": str(province.country_id)}), spec)
    assert city in list(qs)
    qs = filtered_queryset(SimpleNamespace(GET={"province__country": "99999"}), spec)
    assert city not in list(qs)


# ---------- CRUD ----------

def test_province_create_read_update_delete(monkeypatch: pytest.MonkeyPatch) -> None:
    actor = _actor()
    monkeypatch.setattr(resources, "_check", lambda *a, **k: actor)
    monkeypatch.setattr(resources, "_item", lambda request, spec, item_id, lock=False: spec.model.objects.get(pk=item_id))
    monkeypatch.setattr(resources, "require_recent_reauthentication", lambda *a, **k: None)
    spec = get_resource("geography.province")
    assert spec
    country = _country()
    request = _request(actor)
    province = save_resource(request, spec, {
        "country": country.pk, "name_fa": "استان اصفهان آزمون", "name_en": "IsfahanT", "slug": "isfahan-test-zzz",
        "short_description": "مرکز تاریخی", "description": "توضیح", "economic_description": "اقتصاد",
        "area_sq_km": "107029", "population": "2278067", "latitude": "32.6539", "longitude": "51.6660",
        "is_published": True,
    })
    province.refresh_from_db()
    assert province.name_fa == "استان اصفهان آزمون" and province.is_published and province.population == 2278067
    row = serialize_record(province, spec)
    assert row["name_en"] == "IsfahanT"
    province = save_resource(request, spec, {"name_fa": "استان اصفهان آزمون شهر"}, province)
    assert province.name_fa == "استان اصفهان آزمون شهر"
    resources.delete_record(request, "geography.province", str(province.pk))
    assert not Province.objects.filter(pk=province.pk).exists()


def test_province_delete_requires_reauth(monkeypatch: pytest.MonkeyPatch) -> None:
    actor = _actor()
    monkeypatch.setattr(resources, "_item", lambda *a, **k: _province())
    monkeypatch.setattr(resources, "_check", lambda *a, **k: actor)
    called = {"reauth": False}

    def _reauth(request):  # type: ignore[no-untyped-def]
        called["reauth"] = True
        raise HttpError(403, "Reauthentication required")

    monkeypatch.setattr(resources, "require_recent_reauthentication", _reauth)
    with pytest.raises(HttpError, match="Reauthentication"):
        resources.delete_record(_request(actor), "geography.province", "1")
    assert called["reauth"]


def test_django_validation_preserved_on_province() -> None:
    actor = _actor()
    spec = get_resource("geography.province")
    assert spec
    country = _country()
    existing = _province(country)
    # duplicate slug -> unique violation as 422 not 500
    with pytest.raises(HttpError) as exc:
        save_resource(_request(actor), spec, {"country": country.pk, "name_fa": "دیگر", "name_en": "Other", "slug": existing.slug})
    assert exc.value.status_code == 422
    # missing required name_fa
    with pytest.raises(HttpError) as exc2:
        save_resource(_request(actor), spec, {"country": country.pk, "name_fa": "", "name_en": "x", "slug": "x2-zzz"})
    assert exc2.value.status_code == 422


def test_city_create_update_delete_and_county_center() -> None:
    actor = _actor()
    spec = get_resource("geography.city")
    assert spec
    province = _province()
    request = _request(actor)
    city = save_resource(request, spec, {"province": province.pk, "name_fa": "شهر آزمون", "name_en": "TestCity", "slug": "testcity-zzz", "population": "100000", "is_county_center": True})
    assert city.is_county_center and city.population == 100000
    city = save_resource(request, spec, {"is_county_center": False}, city)
    assert not city.is_county_center
    city.delete()
    assert not City.objects.filter(pk=city.pk).exists()


# ---------- province industry inline ----------

def test_province_industry_crud_and_active_cities_rule() -> None:
    actor = _actor()
    spec = get_resource("geography.provinceindustry")
    assert spec
    province = _province()
    other_province = _province(province.country, slug="other-test-zzz", name_fa="استان دیگر آزمون")
    industry = Industry.objects.create(name_fa="فولاد آزمون", name_en="Steel", slug="steel-test-zzz")
    local_city = City.objects.create(province=province, name_fa="شهرستان آزمون", name_en="Town", slug="town-test-zzz")
    foreign_city = City.objects.create(province=other_province, name_fa="شهر دیگر آزمون", name_en="Mcity", slug="mcity-test-zzz")
    request = _request(actor)
    obj = save_resource(request, spec, {"province": province.pk, "industry": industry.pk, "activity_level": "high", "active_cities": [local_city.pk], "description": "x"})
    assert list(obj.active_cities.values_list("pk", flat=True)) == [local_city.pk]
    with pytest.raises(HttpError):
        save_resource(request, spec, {"active_cities": [foreign_city.pk]}, obj)
    with pytest.raises(HttpError):
        save_resource(request, spec, {"production_capacity": "100", "production_capacity_unit": "", "updated_year": None}, obj)
    obj.delete()
    assert not ProvinceIndustry.objects.filter(pk=obj.pk).exists()


def test_province_industry_inline_sync_atomic(monkeypatch: pytest.MonkeyPatch) -> None:
    actor = _actor()
    monkeypatch.setattr(resources, "require_recent_reauthentication", lambda *a, **k: None)
    monkeypatch.setattr(resources, "_check", lambda *a, **k: actor)
    monkeypatch.setattr(resources, "scope_queryset", lambda request, queryset: queryset)
    province = _province()
    industry = Industry.objects.create(name_fa="فولاد آزمون", name_en="Steel", slug="steel-test-zzz")
    request = _request(actor)
    payload = resources.InlineSyncIn(creates=[{"industry": str(industry.pk), "activity_level": "high"}], updates=[], deletes=[])
    result = resources.sync_inline(request, "geography.province", str(province.pk), "provinceindustry", payload)
    assert len(result["created"]) == 1
    child_id = result["created"][0]
    child = ProvinceIndustry.objects.get(pk=child_id)
    assert child.province_id == province.pk and child.industry_id == industry.pk
    resources.sync_inline(request, "geography.province", str(province.pk), "provinceindustry",
                          resources.InlineSyncIn(creates=[], updates=[{"id": child_id, "activity_level": "strategic"}], deletes=[]))
    child.refresh_from_db()
    assert child.activity_level == "strategic"
    resources.sync_inline(request, "geography.province", str(province.pk), "provinceindustry",
                          resources.InlineSyncIn(creates=[], updates=[], deletes=[child_id]))
    assert not ProvinceIndustry.objects.filter(pk=child_id).exists()
    before = ProvinceIndustry.objects.count()
    with pytest.raises(HttpError):
        resources.sync_inline(request, "geography.province", str(province.pk), "provinceindustry",
                              resources.InlineSyncIn(creates=[{"industry": "99999"}], updates=[], deletes=[]))
    assert ProvinceIndustry.objects.count() == before


def test_inline_parent_fk_cannot_be_reassigned(monkeypatch: pytest.MonkeyPatch) -> None:
    actor = _actor()
    monkeypatch.setattr(resources, "require_recent_reauthentication", lambda *a, **k: None)
    monkeypatch.setattr(resources, "_check", lambda *a, **k: actor)
    monkeypatch.setattr(resources, "scope_queryset", lambda request, queryset: queryset)
    province = _province()
    other = _province(province.country, slug="other-test-zzz", name_fa="استان دیگر آزمون")
    industry = Industry.objects.create(name_fa="فولاد آزمون", name_en="Steel", slug="steel-test-zzz")
    result = resources.sync_inline(_request(actor), "geography.province", str(province.pk), "provinceindustry",
                                   resources.InlineSyncIn(creates=[{"industry": str(industry.pk), "province": str(other.pk)}], updates=[], deletes=[]))
    child = ProvinceIndustry.objects.get(pk=result["created"][0])
    assert child.province_id == province.pk


# ---------- permissions ----------

def test_super_administrator_full_access() -> None:
    root = _actor()
    AdminProfile.objects.create(user=root, mfa_confirmed=True)
    for action in ("view", "create", "update", "delete"):
        assert can_manage(root, "geography", "province", action)
        assert can_manage(root, "geography", "city", action)
        assert can_manage(root, "geography", "provinceindustry", action)


def test_delegated_administrator_requires_scope() -> None:
    User = get_user_model()
    actor = User.objects.create_user(email="delegated@example.test", password="x", phone="+989120000002", is_staff=True)
    profile = AdminProfile.objects.create(user=actor, mfa_confirmed=True)
    assert not can_manage(actor, "geography", "province", "create")
    profile.individual_actions = ["geography.province.create"]
    profile.save()
    assert can_manage(actor, "geography", "province", "create")
    assert not can_manage(actor, "geography", "province", "delete")
    profile.individual_actions = []
    profile.save()
    perm = Permission.objects.get(content_type=ContentType.objects.get_for_model(Province), codename="add_province")
    actor.user_permissions.add(perm)
    actor = User.objects.get(pk=actor.pk)
    assert can_manage(actor, "geography", "province", "create")
