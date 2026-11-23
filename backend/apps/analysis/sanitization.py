from html import escape
from html.parser import HTMLParser
from urllib.parse import urlsplit

ALLOWED_TAGS = {
    "a",
    "b",
    "blockquote",
    "br",
    "caption",
    "code",
    "em",
    "figcaption",
    "figure",
    "h2",
    "h3",
    "h4",
    "hr",
    "i",
    "img",
    "li",
    "ol",
    "p",
    "pre",
    "strong",
    "sub",
    "sup",
    "table",
    "tbody",
    "td",
    "tfoot",
    "th",
    "thead",
    "tr",
    "ul",
}
VOID_TAGS = {"br", "hr", "img"}


def _safe_url(value: str, *, image: bool = False) -> bool:
    parsed = urlsplit(value.strip())
    return (
        parsed.scheme.lower() == "https"
        if image
        else parsed.scheme.lower() in {"http", "https", "mailto"}
    )


class _Sanitizer(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.output: list[str] = []
        self.stack: list[str] = []
        self.suppressed = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in {"script", "style", "iframe", "object", "svg", "math"}:
            self.suppressed += 1
            return
        if self.suppressed or tag not in ALLOWED_TAGS:
            return

        values = dict(attrs)
        safe_attrs: list[tuple[str, str]] = []
        if tag == "a":
            href = values.get("href") or ""
            if href and _safe_url(href):
                safe_attrs.append(("href", href))
            if values.get("title"):
                safe_attrs.append(("title", values["title"] or ""))
        elif tag == "img":
            src = values.get("src") or ""
            if not src or not _safe_url(src, image=True):
                return
            safe_attrs.extend((("src", src), ("loading", "lazy")))
            if values.get("alt") is not None:
                safe_attrs.append(("alt", values["alt"] or ""))
            if values.get("title"):
                safe_attrs.append(("title", values["title"] or ""))
        elif tag in {"td", "th"}:
            for name in ("colspan", "rowspan"):
                value = values.get(name) or ""
                if value.isdigit() and 1 <= int(value) <= 100:
                    safe_attrs.append((name, value))

        attr_text = "".join(f' {name}="{escape(value, quote=True)}"' for name, value in safe_attrs)
        self.output.append(f"<{tag}{attr_text}>")
        if tag not in VOID_TAGS:
            self.stack.append(tag)

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style", "iframe", "object", "svg", "math"}:
            self.suppressed = max(0, self.suppressed - 1)
            return
        if self.suppressed or tag not in self.stack:
            return
        while self.stack:
            current = self.stack.pop()
            self.output.append(f"</{current}>")
            if current == tag:
                break

    def handle_data(self, data: str) -> None:
        if not self.suppressed:
            self.output.append(escape(data, quote=False))

    def handle_entityref(self, name: str) -> None:
        if not self.suppressed:
            self.output.append(f"&amp;{escape(name)};")

    def handle_charref(self, name: str) -> None:
        if not self.suppressed:
            self.output.append(f"&amp;#{escape(name)};")


def sanitize_html(value: str) -> str:
    parser = _Sanitizer()
    parser.feed(value)
    parser.close()
    while parser.stack:
        parser.output.append(f"</{parser.stack.pop()}>")
    return "".join(parser.output)
