import uuid
from pathlib import Path

from django.db.models import Model
from django.utils import timezone
from django.utils.deconstruct import deconstructible


@deconstructible
class UploadTo:
    """``upload_to`` that never trusts the client's file name.

    Files land in ``<folder>/<year>/<month>/<random-hex><ext>``.
    """

    def __init__(self, folder: str) -> None:
        self.folder = folder

    def __call__(self, instance: Model, filename: str) -> str:
        extension = Path(filename).suffix.lower()
        return f"{self.folder}/{timezone.now():%Y/%m}/{uuid.uuid4().hex}{extension}"
