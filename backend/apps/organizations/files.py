from pathlib import Path

from django.core.files.uploadedfile import UploadedFile

from apps.core.errors import ApiError

MAX_DOCUMENT_BYTES = 5 * 1024 * 1024
_EXTENSIONS = {
    ".pdf": "application/pdf",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
}


def validate_private_document(upload: UploadedFile) -> None:
    extension = Path(upload.name or "").suffix.lower()
    expected = _EXTENSIONS.get(extension)
    if expected is None:
        raise ApiError("فقط فایل PDF، JPG، PNG یا WebP پذیرفته می‌شود.")
    if upload.size is not None and upload.size > MAX_DOCUMENT_BYTES:
        raise ApiError("حجم فایل باید حداکثر ۵ مگابایت باشد.")
    content_type = (upload.content_type or "").split(";")[0].strip().lower()
    if content_type and content_type != expected:
        raise ApiError("نوع فایل با پسوند آن هم‌خوان نیست.")
