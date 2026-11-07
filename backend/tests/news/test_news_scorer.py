from types import SimpleNamespace

from apps.news.services.news_scorer import calculate_topic_score, classify_content


def topic(name, keywords):
    return SimpleNamespace(name=name, keywords=keywords)


def test_generic_keywords_alone_do_not_qualify_a_news_topic():
    generic_topic = topic("کشاورزی", ["کشور", "طرح", "تولید", "بازار"])

    assigned_topic, score = classify_content(
        "طرح تولید در بازار کشور",
        "گزارش تازه درباره بازار و تولید در کشور",
        topics=[generic_topic],
    )

    assert assigned_topic is None
    assert score == 0
    assert calculate_topic_score(
        "طرح تولید در بازار کشور",
        "",
        generic_topic.keywords,
    ) == 0


def test_topic_with_stronger_specific_evidence_wins_independent_of_order():
    weak_topic = topic("موضوع ضعیف", ["گندم"])
    strong_topic = topic("موضوع قوی", ["گندم", "برنج"])
    title = "افزایش تولید گندم و برنج"

    first, first_score = classify_content(
        title,
        "",
        topics=[weak_topic, strong_topic],
    )
    second, second_score = classify_content(
        title,
        "",
        topics=[strong_topic, weak_topic],
    )

    assert first == strong_topic
    assert second == strong_topic
    assert first_score == second_score == 95


def test_score_100_requires_multiple_specific_title_matches_and_summary_support():
    keywords = ["گندم", "برنج", "زعفران", "صادرات"]

    sparse_score = calculate_topic_score("گندم و برنج", "", keywords)
    strong_score = calculate_topic_score(
        "گندم و برنج و زعفران",
        "افزایش صادرات زعفران",
        keywords,
    )

    assert sparse_score == 95
    assert strong_score == 100


def test_overlapping_keyword_phrase_is_not_counted_as_two_signals():
    score = calculate_topic_score(
        "رشد قیمت نفت",
        "",
        ["نفت", "قیمت نفت"],
    )

    assert score == 60


def test_generic_rss_tag_does_not_assign_a_topic():
    generic_topic = topic("کشاورزی", ["گندم", "بازار", "تولید"])

    assigned_topic, score = classify_content(
        "گزارش اقتصادی امروز",
        "خبرهای تازه",
        topics=[generic_topic],
        tags=["بازار", "تولید"],
    )

    assert assigned_topic is None
    assert score == 0


def test_specific_rss_tag_can_assign_topic_and_break_topic_ties():
    agriculture = topic("کشاورزی", ["گندم", "برنج"])
    energy = topic("انرژی", ["نفت", "گاز"])

    assigned_topic, score = classify_content(
        "گزارش تازه منتشر شد",
        "",
        topics=[agriculture, energy],
        tags=["نفت"],
    )

    assert assigned_topic == energy
    assert score == 45


def test_exact_topic_tag_is_strong_evidence_without_keyword_overlap():
    agriculture = topic("کشاورزی و صنایع غذایی", ["گندم", "برنج"])

    assigned_topic, score = classify_content(
        "گزارش تازه منتشر شد",
        "",
        topics=[agriculture],
        tags=["کشاورزی و صنایع غذایی"],
    )

    assert assigned_topic == agriculture
    assert score == 60
