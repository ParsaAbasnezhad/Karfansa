from django.conf import settings
from django.core.files.storage import FileSystemStorage


class PrivateAnalysisStorage(FileSystemStorage):
    def __init__(self) -> None:
        super().__init__(location=settings.BASE_DIR / "private_media" / "analysis")
