from django.db.models import QuerySet

from apps.home.models import AboutPageContent, Slide


def list_active_slides() -> QuerySet[Slide]:
    return Slide.objects.filter(is_active=True)


def get_about_page_content() -> AboutPageContent:
    return AboutPageContent.objects.get(pk=1)
