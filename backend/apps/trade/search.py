import re
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Any

from django.conf import settings
from django.contrib.postgres.search import SearchQuery, SearchRank, SearchVector
from django.db import connection
from django.db.models import (
    Case,
    CharField,
    ExpressionWrapper,
    F,
    IntegerField,
    Q,
    Value,
    When,
)
from django.db.models.functions import Cast, Coalesce, Lower
from django.utils import timezone

from apps.geography.models import City, Province
from apps.organizations.models import IndustryCategory, Organization, Product

from .selectors import visible_linked_listing_q

DEFAULT_WEIGHTS = {
    "product_exact": 1000,
    "product_synonym": 850,
    "title": 700,
    "requirements": 620,
    "description": 450,
    "category": 320,
    "technical": 280,
    "location": 220,
    "opportunity_type": 220,
    "quantity": 120,
}

PRODUCT_SYNONYMS = {
    "گندم": ("wheat", "گندم خوراکی"),
    "خرما": ("date", "dates"),
    "پسته": ("pistachio", "pistachios"),
    "زعفران": ("saffron",),
    "برنج": ("rice",),
    "میلگرد": ("rebar", "reinforcing steel"),
    "ماشین آلات": ("machinery", "industrial equipment"),
    "مواد اولیه": ("raw material", "raw materials"),
}

QUERY_STOP_WORDS = {
    "به",
    "در",
    "از",
    "برای",
    "با",
    "که",
    "و",
    "یا",
    "یک",
    "را",
    "نیاز",
    "دارد",
    "دارند",
    "ای",
    "مورد",
    "می",
    "شود",
    "شده",
    "کارخانه",
    "کارخانه‌ای",
    "استان",
    "شهر",
    "شهرستان",
    "فرصت",
}

PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹"
ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩"
ASCII_DIGITS = "0123456789"
ARABIC_CHARACTERS = str.maketrans(
    {
        "\u064a": "\u06cc",
        "\u0649": "\u06cc",
        "\u0643": "\u06a9",
        "\u06c0": "\u0647",
        "\u0629": "\u0647",
    }
)
ARABIC_SEARCH_VARIANTS = str.maketrans(
    {"\u06cc": "\u064a", "\u06a9": "\u0643"}
)
DIGIT_TRANSLATION = str.maketrans(
    {
        **dict(zip(PERSIAN_DIGITS, ASCII_DIGITS, strict=True)),
        **dict(zip(ARABIC_DIGITS, ASCII_DIGITS, strict=True)),
    }
)


@dataclass(frozen=True)
class SearchInterpretation:
    terms: tuple[str, ...]
    product: str = ""
    province: str = ""
    city: str = ""
    category: str = ""
    opportunity_type: str = ""
    quantity: Decimal | None = None
    quantity_unit: str = ""


def normalize_search_text(value: str) -> str:
    value = value.translate(ARABIC_CHARACTERS).translate(DIGIT_TRANSLATION)
    value = value.replace("\u0640", "").replace("\u200c", " ").replace("\u200f", "")
    value = re.sub(r"[\u064b-\u065f]", "", value)
    return " ".join(value.lower().split())


def _normalized_db_field(field_name: str) -> Any:
    expression = Coalesce(
        Lower(F(field_name)), Value(""), output_field=CharField()
    )
    return Lower(expression, output_field=CharField())


def _search_variants(term: str) -> tuple[str, ...]:
    variants = {term, term.translate(ARABIC_SEARCH_VARIANTS)}
    return tuple(
        dict.fromkeys(
            variant_form
            for variant in variants
            for variant_form in (variant, variant.replace(" ", "\u200c"))
        )
    )


def _synonym_terms(text: str) -> set[str]:
    normalized = normalize_search_text(text)
    terms = set(re.findall(r"[\w]+", normalized, flags=re.UNICODE))
    for canonical, synonyms in PRODUCT_SYNONYMS.items():
        normalized_canonical = normalize_search_text(canonical)
        normalized_synonyms = {normalize_search_text(item) for item in synonyms}
        if normalized_canonical in normalized or normalized_canonical in terms:
            terms.update(normalized_synonyms)
        if any(synonym in normalized for synonym in normalized_synonyms):
            terms.add(normalized_canonical)
    return terms


def _extract_quantity(text: str) -> tuple[Decimal | None, str]:
    match = re.search(
        r"(?<!\w)(\d{1,3}(?:[\u066c,]\d{3})+|\d+(?:[.\u066b,]\d+)?)\s*"
        r"(تن|کیلوگرم|کیلو|گرم|لیتر|متر|عدد|دستگاه|کیسه|تن\s*در\s*سال)?",
        text,
    )
    if not match:
        return None, ""
    raw_amount = (
        match.group(1).replace(",", "").replace("\u066c", "").replace("\u066b", ".")
    )
    try:
        amount = Decimal(raw_amount)
    except InvalidOperation:
        return None, ""
    return amount, (match.group(2) or "").strip()


def interpret_search_query(query: str) -> SearchInterpretation:
    normalized = normalize_search_text(query)
    raw_terms = re.findall(r"[\w]+", normalized, flags=re.UNICODE)
    terms = {
        term
        for term in raw_terms
        if term not in QUERY_STOP_WORDS and not term.isdecimal() and len(term) > 1
    }
    terms.update(_synonym_terms(" ".join(terms)))

    products = list(Product.objects.values_list("name_fa", "name_en"))
    product = ""
    product_candidates: list[tuple[int, str]] = []
    for name_fa, name_en in products:
        for name in (name_fa, name_en):
            candidate = normalize_search_text(name)
            if candidate and candidate in normalized:
                product_candidates.append((len(candidate), name_fa))
                break
    if product_candidates:
        product = max(product_candidates)[1]
        terms.update(_synonym_terms(product))

    province = ""
    province_matches = list(
        Province.objects.filter(
            country__iso2="IR", is_published=True
        ).values_list("slug", "name_fa", "name_en")
    )
    for slug, name_fa, name_en in province_matches:
        if any(
            candidate and normalize_search_text(candidate) in normalized
            for candidate in (name_fa, name_en, slug.replace("-", " "))
        ):
            province = slug
            break

    city = ""
    if re.search(r"\b(?:شهر|شهرستان|city|county)\b", normalized):
        cities = City.objects.filter(
            province__country__iso2="IR",
            province__is_published=True,
        ).values_list("slug", "name_fa", "name_en")
        for slug, name_fa, name_en in cities:
            if any(
                candidate and normalize_search_text(candidate) in normalized
                for candidate in (name_fa, name_en)
            ):
                city = slug
                break

    category = ""
    category_aliases = {
        "agriculture": ("کشاورزی", "محصولات کشاورزی"),
        "food": ("مواد غذایی", "صنایع غذایی"),
        "energy": ("انرژی", "پتروشیمی"),
        "mining": ("معدن", "معدنی"),
        "metals": ("فلز", "فولاد", "صنایع فلزی"),
        "textiles": ("نساجی", "پوشاک"),
        "chemicals": ("شیمیایی",),
        "construction": ("ساختمان", "مصالح"),
        "livestock-fisheries": ("دامپروری", "شیلات", "آبزیان"),
        "handicrafts": ("صنایع دستی",),
        "technology": ("فناوری", "دانش بنیان"),
    }
    for value, label in IndustryCategory.choices:
        phrases = (label, *category_aliases.get(value, ()))
        if any(normalize_search_text(phrase) in normalized for phrase in phrases):
            category = value
            break

    opportunity_type = ""
    type_patterns = (
        ("raw-materials", r"مواد\s+اولیه|تامین|تأمین"),
        ("investment", r"سرمایه\s*گذاری|سرمایه‌گذاری"),
        ("export", r"صادرات|صادراتی"),
        ("import", r"واردات|وارداتی"),
        ("bulk-buy", r"خرید|خریدار|نیاز\s+به|نیاز\s+دارد|نیازمند"),
        ("bulk-sell", r"فروش|فروشنده|عرضه"),
        ("partnership", r"مشارکت|همکاری"),
    )
    for value, pattern in type_patterns:
        if re.search(pattern, normalized):
            opportunity_type = value
            break

    quantity, quantity_unit = _extract_quantity(normalized)
    if not terms:
        terms = set(raw_terms)
    return SearchInterpretation(
        terms=tuple(sorted(terms)[:16]),
        product=product,
        province=province,
        city=city,
        category=category,
        opportunity_type=opportunity_type,
        quantity=quantity,
        quantity_unit=quantity_unit,
    )


def configured_weights() -> dict[str, int]:
    weights = DEFAULT_WEIGHTS.copy()
    weights.update(getattr(settings, "TRADE_SEARCH_WEIGHTS", {}))
    return weights


def has_verified_contact(company: Organization | None) -> bool:
    if not company or not company.is_active or not company.is_verified:
        return False
    return bool(
        re.fullmatch(r"\+?[0-9\s\-()]{5,20}", company.phone)
        or re.fullmatch(r"\+?[0-9\s\-()]{5,20}", company.mobile)
        or re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", company.email)
    )


def _matches_any(fields: tuple[str, ...], terms: tuple[str, ...]) -> Q:
    condition = Q()
    for field in fields:
        for term in terms:
            if term:
                for variant in _search_variants(term):
                    condition |= Q(**{f"{field}__contains": variant})
    return condition


def annotate_search_fields(queryset: Any) -> Any:
    fields = {
        "title_norm": "title",
        "description_norm": "description",
        "market_norm": "target_market",
        "volume_unit_norm": "volume_unit",
        "product_fa_norm": "product__name_fa",
        "product_en_norm": "product__name_en",
        "product_description_norm": "product__description",
        "industry_fa_norm": "industry__name_fa",
        "industry_en_norm": "industry__name_en",
        "industry_description_norm": "industry__description",
        "province_fa_norm": "province__name_fa",
        "province_en_norm": "province__name_en",
        "city_fa_norm": "city__name_fa",
        "city_en_norm": "city__name_en",
        "volume_norm": "required_volume",
    }
    for annotation, field in fields.items():
        if field == "required_volume":
            expression = Coalesce(Cast(F(field), output_field=CharField()), Value(""))
            queryset = queryset.annotate(**{annotation: Lower(expression)})
        else:
            queryset = queryset.annotate(**{annotation: _normalized_db_field(field)})
    return queryset


def opportunity_search_score(
    *,
    query: str,
    interpretation: SearchInterpretation,
    province: str = "",
    city: str = "",
    category: str = "",
    opportunity_type: str = "",
    product: str = "",
    status: str = "active",
    min_quantity: Decimal | None = None,
    max_quantity: Decimal | None = None,
    volume_unit: str = "",
    date_from: Any = None,
    date_to: Any = None,
    has_contact: bool = False,
    ordering: str = "relevance",
) -> Any:
    from .models import OpportunityReviewStatus, TradeOpportunity

    queryset = (
        TradeOpportunity.objects.filter(
            province__country__iso2="IR",
            province__is_published=True,
            review_status=OpportunityReviewStatus.APPROVED,
            is_published=True,
        )
        .filter(Q(valid_until__isnull=True) | Q(valid_until__gte=timezone.localdate()))
        .filter(visible_linked_listing_q())
        .select_related(
            "province",
            "city",
            "product",
            "industry",
            "company",
            "service_listing",
            "service_listing__category",
        )
    )
    if province or interpretation.province:
        queryset = queryset.filter(province__slug=province or interpretation.province)
    if city:
        queryset = queryset.filter(city_id=int(city)) if city.isdecimal() else queryset.filter(
            city__slug=city
        )
    if category:
        queryset = queryset.filter(
            Q(industry__category=category) | Q(company__industry__category=category)
        )
    if opportunity_type:
        queryset = queryset.filter(opportunity_type=opportunity_type)
    if product:
        queryset = queryset.filter(
            Q(product__slug=product)
            | Q(service_listing__slug=product)
            | Q(service_listing__category__slug=product)
        )
    if status == "expiring":
        from datetime import timedelta

        queryset = queryset.filter(
            valid_until__lte=timezone.localdate() + timedelta(days=30)
        )
    if min_quantity is not None:
        queryset = queryset.filter(required_volume__gte=min_quantity)
    if max_quantity is not None:
        queryset = queryset.filter(required_volume__lte=max_quantity)
    if volume_unit:
        queryset = queryset.filter(volume_unit__iexact=volume_unit)
    if date_from:
        queryset = queryset.filter(published_at__date__gte=date_from)
    if date_to:
        queryset = queryset.filter(published_at__date__lte=date_to)
    if has_contact:
        queryset = queryset.filter(company__is_active=True, company__is_verified=True).filter(
            Q(company__phone__regex=r"^\+?[0-9\s\-()]{5,20}$")
            | Q(company__mobile__regex=r"^\+?[0-9\s\-()]{5,20}$")
            | Q(company__email__regex=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
        )

    terms = tuple(dict.fromkeys(interpretation.terms))
    if query:
        queryset = annotate_search_fields(queryset)
        field_groups = {
            "title": ("title_norm",),
            "requirements": ("description_norm", "market_norm"),
            "description": ("description_norm", "market_norm"),
            "category": ("industry_fa_norm", "industry_en_norm", "industry_description_norm"),
            "technical": (
                "product_description_norm",
                "volume_unit_norm",
                "volume_norm",
            ),
            "location": (
                "province_fa_norm",
                "province_en_norm",
                "city_fa_norm",
                "city_en_norm",
            ),
        }
        product_fields = ("product_fa_norm", "product_en_norm")
        all_fields = (
            *field_groups["title"],
            *field_groups["requirements"],
            *field_groups["description"],
            *field_groups["category"],
            *field_groups["technical"],
            *field_groups["location"],
            *product_fields,
        )
        matching = _matches_any(all_fields, terms)
        phrase = normalize_search_text(query)
        if phrase:
            matching |= _matches_any(all_fields, (phrase,))
        if connection.vendor == "postgresql" and terms:
            vector = (
                SearchVector("title", weight="A", config="simple")
                + SearchVector("product__name_fa", weight="A", config="simple")
                + SearchVector("product__name_en", weight="A", config="simple")
                + SearchVector("description", weight="B", config="simple")
                + SearchVector("industry__name_fa", weight="C", config="simple")
            )
            search_query = SearchQuery(" ".join(terms), config="simple", search_type="plain")
            queryset = queryset.annotate(
                _fts_rank=Coalesce(SearchRank(vector, search_query), Value(0.0))
            )
            matching |= Q(_fts_rank__gt=0)

        queryset = queryset.filter(matching).distinct()
        weights = configured_weights()
        score: Any = Value(0, output_field=IntegerField())

        def add_score(condition: Q, key: str) -> None:
            nonlocal score
            score = ExpressionWrapper(
                score
                + Case(
                    When(condition, then=Value(weights[key])),
                    default=Value(0),
                    output_field=IntegerField(),
                ),
                output_field=IntegerField(),
            )

        exact_product_terms = (
            [normalize_search_text(interpretation.product)]
            if interpretation.product
            else []
        )
        exact_product_terms.extend(term for term in terms if len(term) > 2)
        exact_product_names = tuple(
            dict.fromkeys(
                variant
                for term in exact_product_terms
                for variant in _search_variants(term)
            )
        )
        add_score(
            _matches_any(product_fields, tuple(exact_product_names))
            & (
                Q(product_fa_norm__in=exact_product_names)
                | Q(product_en_norm__in=exact_product_names)
            ),
            "product_exact",
        )
        add_score(_matches_any(product_fields, terms), "product_synonym")
        add_score(_matches_any(field_groups["title"], terms), "title")
        add_score(_matches_any(field_groups["requirements"], terms), "requirements")
        add_score(_matches_any(field_groups["description"], terms), "description")
        add_score(_matches_any(field_groups["category"], terms), "category")
        add_score(_matches_any(field_groups["technical"], terms), "technical")
        add_score(_matches_any(field_groups["location"], terms), "location")
        if interpretation.category:
            add_score(Q(industry__category=interpretation.category), "category")
        if interpretation.opportunity_type:
            add_score(
                Q(opportunity_type=interpretation.opportunity_type),
                "opportunity_type",
            )
        if interpretation.quantity is not None:
            quantity_condition = Q(required_volume=interpretation.quantity)
            if interpretation.quantity_unit:
                quantity_condition &= Q(volume_unit__icontains=interpretation.quantity_unit)
            add_score(quantity_condition, "quantity")
        queryset = queryset.annotate(_search_score=score)
    else:
        queryset = queryset.annotate(_search_score=Value(0, output_field=IntegerField()))

    if ordering == "newest":
        return queryset.order_by("-published_at", "pk")
    if ordering == "oldest":
        return queryset.order_by("published_at", "pk")
    if ordering == "quantity":
        return queryset.order_by(F("required_volume").desc(nulls_last=True), "-published_at", "pk")
    if query and connection.vendor == "postgresql":
        return queryset.order_by(
            "-_search_score",
            "-_fts_rank",
            "-relevance_score",
            "-published_at",
            "pk",
        )
    return queryset.order_by("-_search_score", "-relevance_score", "-published_at", "pk")
