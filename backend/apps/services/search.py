import re

PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹"
ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩"
ASCII_DIGITS = "0123456789"

_TRANSLATION = str.maketrans(
    {
        "\u064a": "\u06cc",
        "\u0649": "\u06cc",
        "\u0643": "\u06a9",
        "\u06c0": "\u0647",
        "\u0629": "\u0647",
        **dict(zip(PERSIAN_DIGITS, ASCII_DIGITS, strict=True)),
        **dict(zip(ARABIC_DIGITS, ASCII_DIGITS, strict=True)),
    }
)


def normalize_search_text(value: str) -> str:
    value = value.translate(_TRANSLATION)
    value = value.replace("\u0640", "").replace("\u200c", " ").replace("\u200f", "")
    value = re.sub(r"[\u064b-\u065f]", "", value)
    return " ".join(value.lower().split())
