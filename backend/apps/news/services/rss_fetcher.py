
import calendar
import ipaddress
import socket
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse

import feedparser
import requests
from django.utils import timezone

from apps.news.models import News, NewsSource, NewsTopic
from apps.news.services.news_scorer import classify_content

USER_AGENT = "KarfansaNewsBot/1.0"
REQUEST_TIMEOUT = 15
MAX_RESPONSE_SIZE = 5 * 1024 * 1024  # 5 MB
MAX_REDIRECTS = 3


class _SummaryTextParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []

    def handle_data(self, data):
        if data.strip():
            self.parts.append(data.strip())

    def get_text(self):
        return " ".join(self.parts)


def extract_summary(entry):
    """استخراج خلاصه متنی از فیلدهای مختلف RSS."""
    summary = entry.get("summary", "") or entry.get("description", "")
    if not isinstance(summary, str):
        summary = str(summary)

    parser = _SummaryTextParser()
    parser.feed(summary)
    return parser.get_text()


def extract_tags(entry):
    """Extract RSS category and tag values as text."""
    values = []
    for field in ("tags", "category", "categories"):
        field_values = entry.get(field, [])
        if isinstance(field_values, (str, dict)):
            field_values = [field_values]

        for value in field_values or []:
            if isinstance(value, dict):
                values.extend((value.get("term", ""), value.get("label", "")))
            elif isinstance(value, str):
                values.append(value)

    tags = []
    seen = set()
    for value in values:
        if not isinstance(value, str):
            continue
        normalized = value.strip()
        if normalized and normalized.casefold() not in seen:
            seen.add(normalized.casefold())
            tags.append(normalized)
    return tags


def validate_rss_url(url):
    """بررسی اولیه URL و جلوگیری از دسترسی به آدرس‌های خصوصی."""

    parsed = urlparse(url)

    if parsed.scheme not in ("http", "https"):
        raise ValueError("Only HTTP and HTTPS URLs are allowed.")

    if not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("Invalid RSS URL.")

    try:
        addresses = socket.getaddrinfo(
            parsed.hostname,
            parsed.port or (443 if parsed.scheme == "https" else 80),
            type=socket.SOCK_STREAM,
        )
    except socket.gaierror as exc:
        raise ValueError("RSS host could not be resolved.") from exc

    for address in addresses:
        ip = ipaddress.ip_address(address[4][0])

        if not ip.is_global:
            raise ValueError("Private or non-public IP addresses are not allowed.")


def download_feed(url):
    """دریافت RSS با محدودیت حجم، زمان و تعداد Redirect."""

    current_url = url

    for _ in range(MAX_REDIRECTS + 1):
        validate_rss_url(current_url)

        response = requests.get(
            current_url,
            headers={"User-Agent": USER_AGENT},
            timeout=REQUEST_TIMEOUT,
            allow_redirects=False,
            stream=True,
        )

        if response.is_redirect:
            location = response.headers.get("Location")
            response.close()

            if not location:
                raise ValueError("Invalid redirect response.")

            current_url = urljoin(current_url, location)
            continue

        response.raise_for_status()

        content = bytearray()

        for chunk in response.iter_content(chunk_size=8192):
            content.extend(chunk)

            if len(content) > MAX_RESPONSE_SIZE:
                response.close()
                raise ValueError("RSS response exceeds the size limit.")

        response.close()
        return bytes(content)

    raise ValueError("Too many redirects.")


def extract_image(entry):
    """استخراج تصویر خبر از اطلاعات RSS."""

    media = entry.get("media_content", [])
    if media and media[0].get("url"):
        return media[0]["url"]

    thumbnails = entry.get("media_thumbnail", [])
    if thumbnails and thumbnails[0].get("url"):
        return thumbnails[0]["url"]

    enclosures = entry.get("enclosures", [])
    for enclosure in enclosures:
        if enclosure.get("type", "").startswith("image/"):
            return enclosure.get("href", enclosure.get("url", ""))

    return ""


def extract_published_date(entry):
    """تبدیل تاریخ انتشار RSS به datetime آگاه از منطقه زمانی."""

    parsed_date = entry.get("published_parsed") or entry.get("updated_parsed")

    if parsed_date:
        timestamp = calendar.timegm(parsed_date)
        return datetime.fromtimestamp(timestamp, tz=UTC)

    raw_date = entry.get("published") or entry.get("updated")

    if raw_date:
        try:
            result = parsedate_to_datetime(raw_date)

            if result.tzinfo is None:
                result = result.replace(tzinfo=UTC)

            return result
        except (TypeError, ValueError):
            pass

    return None



def fetch_source(source):
    """دریافت، فیلتر و ذخیره خبرهای مرتبط یک منبع RSS."""

    content = download_feed(source.rss_url)
    parsed_feed = feedparser.parse(content)

    if parsed_feed.bozo and not parsed_feed.entries:
        raise ValueError("RSS feed could not be parsed.")

    created_count = 0
    rejected_count = 0

    topics = list(
        NewsTopic.objects.filter(is_active=True)
    )

    for entry in parsed_feed.entries:
        link = entry.get("link", "").strip()
        title = entry.get("title", "").strip()

        if not link or not title:
            continue

        summary = extract_summary(entry)
        tags = extract_tags(entry)

        # Only scorer-approved items are persisted by this RSS app.
        topic, score = classify_content(
            title=title,
            summary=summary,
            topics=topics,
            tags=tags,
        )

        if topic is None:
            rejected_count += 1
            continue

        published_at = extract_published_date(entry)

        _, created = News.objects.get_or_create(
            original_url=link,
            defaults={
                "source": source,
                "topic": topic,
                "title": title[:300],
                "summary": summary,
                "image_url": extract_image(entry),
                "guid": entry.get("id", "")[:1000],
                "published_at": published_at,
                "score": score,
                "is_published": False,
            },
        )

        if created:
            created_count += 1

    source.last_fetched_at = timezone.now()
    source.save(update_fields=["last_fetched_at"])

    return {
        "created": created_count,
        "rejected": rejected_count,
    }

def fetch_all_sources():
    """دریافت خبر از تمام منابع فعال."""

    results = []

    for source in NewsSource.objects.filter(is_active=True):
        try:
            count = fetch_source(source)

            results.append({
                "source": source.name,
                "status": "success",
                "created": count["created"],
                "rejected": count["rejected"],
            })

        except Exception as exc:
            results.append({
                "source": source.name,
                "status": "failed",
                "error": str(exc),
            })

    return results
