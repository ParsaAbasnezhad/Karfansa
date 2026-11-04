from django.shortcuts import render

from .selectors import list_active_advertisements


def index(request):
    return render(request, "advertising/index.html", {"advertisements": list_active_advertisements()})
