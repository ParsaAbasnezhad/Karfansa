from uuid import UUID

from ninja import Schema

from apps.geography.schemas import CityRef, CountryOut, ProvinceOut, ProvinceRef
from apps.transportation.models import TransportCompany


class TransportModeOut(Schema):
    code: str
    name_fa: str
    name_en: str


class VehicleTypeOut(Schema):
    slug: str
    name_fa: str
    name_en: str


class TransportCompanyFilters(Schema):
    search: str | None = None
    province: str | None = None
    transport_type: str | None = None
    service_province: str | None = None
    customs_services: bool | None = None
    tracking_available: bool | None = None
    insurance_available: bool | None = None
    is_verified: bool | None = None


class TransportCompanyListOut(Schema):
    id: UUID
    slug: str
    name: str
    english_name: str
    logo: str | None
    province: ProvinceRef | None
    city: CityRef | None
    transport_types: list[TransportModeOut]
    tracking_available: bool
    insurance_available: bool
    customs_services: bool
    is_verified: bool

    @staticmethod
    def resolve_logo(obj: TransportCompany) -> str | None:
        return obj.logo.url if obj.logo else None


class TransportCompanyDetailOut(TransportCompanyListOut):
    cover_image: str | None
    description: str
    national_id: str
    registration_number: str
    vehicle_types: list[VehicleTypeOut]
    service_provinces: list[ProvinceOut]
    origin_countries: list[CountryOut]
    destination_countries: list[CountryOut]
    fleet_capacity: str
    address: str
    phone: str
    mobile: str
    email: str
    website: str
    whatsapp: str
    telegram: str

    @staticmethod
    def resolve_cover_image(obj: TransportCompany) -> str | None:
        return obj.cover_image.url if obj.cover_image else None
