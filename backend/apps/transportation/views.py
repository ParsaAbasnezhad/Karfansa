from django.shortcuts import render

from apps.geography.models import Province

from .models import TransportMode
from .selectors import get_public_transport_company, list_public_transport_companies


def index(request):
    filters = {
        key: request.GET.get(key) or None
        for key in ("search", "province", "transport_type", "service_province")
    }
    for key in ("customs_services", "tracking_available", "insurance_available", "is_verified"):
        value = request.GET.get(key)
        filters[key] = value.lower() == "true" if value else None
    return render(request, "transportation/index.html", {
        "companies": list_public_transport_companies(**filters),
        "modes": TransportMode.objects.all(),
        "provinces": Province.objects.all(),
    })


def detail(request, slug):
    return render(request, "transportation/detail.html", {"company": get_public_transport_company(slug)})
