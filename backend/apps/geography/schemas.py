from ninja import Schema


class CountryOut(Schema):
    id: int
    name_fa: str
    name_en: str
    iso2: str


class ProvinceOut(Schema):
    id: int
    slug: str
    name_fa: str
    name_en: str


class ProvinceRef(Schema):
    """Compact province reference embedded in other apps' responses."""

    slug: str
    name_fa: str


class CityRef(Schema):
    id: int
    name_fa: str
