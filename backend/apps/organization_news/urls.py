from django.urls import path

from . import views

app_name = "organization_news"
urlpatterns = [path("", views.index, name="index"), path("<slug:organization_slug>/<slug:slug>/", views.detail, name="detail")]
