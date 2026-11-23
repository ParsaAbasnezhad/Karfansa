from pathlib import PurePosixPath
from zipfile import BadZipFile, ZipFile

from django.core.exceptions import ValidationError

MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024
ALLOWED_ANALYSIS_EXTENSIONS = {".pdf", ".xlsx", ".docx", ".csv", ".txt"}


def safe_original_filename(value: str) -> str:
    filename = PurePosixPath(value.replace("\\", "/")).name
    filename = "".join(char for char in filename if char.isprintable() and char not in "/\\")
    filename = filename.strip(" .")[:255]
    return filename or "download"


def validate_analysis_file(uploaded_file) -> None:
    suffix = PurePosixPath(uploaded_file.name.replace("\\", "/")).suffix.lower()
    if suffix not in ALLOWED_ANALYSIS_EXTENSIONS:
        raise ValidationError("نوع فایل برای بارگذاری گزارش مجاز نیست.", code="invalid_file_type")
    if uploaded_file.size > MAX_ATTACHMENT_BYTES:
        raise ValidationError(
            "حجم فایل نباید بیشتر از ۱۵ مگابایت باشد.",
            code="file_too_large",
        )

    try:
        uploaded_file.seek(0)
        header = uploaded_file.read(8)
        uploaded_file.seek(0)
        if suffix == ".pdf" and not header.startswith(b"%PDF-"):
            raise ValidationError(
                "محتوای فایل با قالب PDF مطابقت ندارد.",
                code="invalid_file_content",
            )
        if suffix in {".xlsx", ".docx"}:
            with ZipFile(uploaded_file) as archive:
                names = set(archive.namelist())
                required = (
                    {"[Content_Types].xml", "xl/workbook.xml"}
                    if suffix == ".xlsx"
                    else {"[Content_Types].xml", "word/document.xml"}
                )
                if not required.issubset(names):
                    raise ValidationError(
                        "محتوای فایل با قالب انتخاب‌شده مطابقت ندارد.",
                        code="invalid_file_content",
                    )
        if suffix in {".csv", ".txt"}:
            uploaded_file.seek(0)
            if b"\x00" in uploaded_file.read(8192):
                raise ValidationError(
                    "فایل متنی دارای محتوای نامعتبر است.",
                    code="invalid_file_content",
                )
    except BadZipFile as exc:
        raise ValidationError("فایل فشرده معتبر نیست.", code="invalid_file_content") from exc
    finally:
        uploaded_file.seek(0)
