from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import UploadedFile
from django.core.validators import FileExtensionValidator, RegexValidator

MAX_IMAGE_BYTES = 2 * 1024 * 1024

# SVG is intentionally excluded: it can carry scripts.
validate_image_extension = FileExtensionValidator(["jpg", "jpeg", "png", "webp"])

validate_digits = RegexValidator(r"^\d+$", "Only digits are allowed.")
validate_phone = RegexValidator(r"^\+?[0-9\s\-()]{5,20}$", "Enter a valid phone number.")


def validate_image_size(file: UploadedFile) -> None:
    if file.size is not None and file.size > MAX_IMAGE_BYTES:
        raise ValidationError("Image must be 2 MB or smaller.", code="file_too_large")
