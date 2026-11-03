from django.db.models import QuerySet

from .models import Country, Province


def list_countries() -> QuerySet[Country]:
    return Country.objects.all()


def list_provinces(*, country_iso2: str | None = None) -> QuerySet[Province]:
    queryset = Province.objects.all()
    if country_iso2:
        queryset = queryset.filter(country__iso2__iexact=country_iso2)
    return queryset
