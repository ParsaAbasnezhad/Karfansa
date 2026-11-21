from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from django.views.generic import RedirectView

from config.api import api


def health_check(request):
    return JsonResponse({
        "status": "healthy",
        "service": "karfansa-backend",
    })



urlpatterns = [

    path("admin/", admin.site.urls),
    path("api/v1/", api.urls),
    path("advertising/", include("apps.advertising.urls")),
    path("geography/", include("apps.geography.urls")),
    path(
        "news/",
        RedirectView.as_view(url="https://karfansa.news.ir/", permanent=True),
        name="legacy-news-redirect",
    ),
    path(
        "news",
        RedirectView.as_view(url="https://karfansa.news.ir/", permanent=True),
        name="legacy-news-no-slash-redirect",
    ),
    path("organizations/", include("apps.organizations.urls")),
    path("transportation/", include("apps.transportation.urls")),

path("api/v1/health/", health_check, name="health-check"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

