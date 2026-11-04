from django.shortcuts import render

from .selectors import get_published_news, list_published_news


def index(request):
    news = list_published_news(organization=request.GET.get("organization") or None, search=request.GET.get("search") or None)
    return render(request, "organization_news/index.html", {"news_list": news})


def detail(request, organization_slug, slug):
    item = get_published_news(organization_slug=organization_slug, slug=slug)
    return render(request, "organization_news/detail.html", {"item": item})
