from django.shortcuts import render

from .selectors import get_public_organization, list_industries, list_public_organizations


def index(request):
    filters = {key: request.GET.get(key) or None for key in ("search", "province", "industry", "organization_type")}
    return render(request, "organizations/index.html", {
        "organizations": list_public_organizations(**filters),
        "industries": list_industries(),
        "filters": request.GET,
    })


def detail(request, slug):
    return render(request, "organizations/detail.html", {"organization": get_public_organization(slug)})
