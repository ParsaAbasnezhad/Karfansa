from pathlib import Path

from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import UploadedFile
from django.core.validators import FileExtensionValidator

MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024
ALLOWED_ATTACHMENT_EXTENSIONS = ["pdf", "png", "jpg", "jpeg", "webp", "txt", "doc", "docx"]
ALLOWED_ATTACHMENT_TYPES = {
    ".pdf": {"application/pdf"},
    ".png": {"image/png"},
    ".jpg": {"image/jpeg"},
    ".jpeg": {"image/jpeg"},
    ".webp": {"image/webp"},
    ".txt": {"text/plain"},
    ".doc": {"application/msword"},
    ".docx": {"application/vnd.openxmlformats-officedocument.wordprocessingml.document"},
}

validate_attachment_extension = FileExtensionValidator(ALLOWED_ATTACHMENT_EXTENSIONS)


def validate_attachment(file: UploadedFile) -> None:
    if file.size is not None and file.size > MAX_ATTACHMENT_BYTES:
        raise ValidationError(
            "حجم فایل باید حداکثر ۵ مگابایت باشد.",  # noqa: RUF001
            code="file_too_large",
        )
    suffix = Path(getattr(file, "name", "") or "").suffix.lower()
    allowed_types = ALLOWED_ATTACHMENT_TYPES.get(suffix)
    if allowed_types is None:
        raise ValidationError("این نوع فایل مجاز نیست.", code="invalid_extension")
    content_type = (getattr(file, "content_type", None) or "").split(";")[0].strip().lower()
    if (
        content_type
        and content_type not in allowed_types
        and content_type != "application/octet-stream"
    ):
        raise ValidationError("نوع فایل با پسوند آن همخوانی ندارد.", code="invalid_mime")
