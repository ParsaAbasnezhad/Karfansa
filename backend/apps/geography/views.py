from django.shortcuts import render

from . import selectors
from .models import City


def index(request):
    return render(request, "geography/index.html", {
        "countries": selectors.list_countries(),
        "provinces": selectors.list_provinces(country_iso2=request.GET.get("country")),
        "cities": City.objects.select_related("province", "province__country"),
    })
