from django.db.models import QuerySet

from apps.home.models import Slide


def list_active_slides() -> QuerySet[Slide]:
    return Slide.objects.filter(is_active=True)
