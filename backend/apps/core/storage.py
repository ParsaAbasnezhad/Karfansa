from django.conf import settings
from django.core.files.storage import FileSystemStorage
from django.utils.deconstruct import deconstructible


@deconstructible
class PrivateFileSystemStorage(FileSystemStorage):
    """Stores verification files outside public media.

    ``base_url`` is intentionally not routed. Downloads go through an
    authenticated API that checks ownership.
    """

    def __init__(self) -> None:
        super().__init__(
            location=str(settings.PRIVATE_MEDIA_ROOT),
            base_url="/private-media-blocked/",
        )
