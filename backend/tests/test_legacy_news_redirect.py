"""The former public news landing URL now leads to the separate news site."""

import pytest
from django.test import Client


@pytest.mark.parametrize("path", ["/news", "/news/"])
def test_legacy_news_landing_redirects_permanently(path: str, client: Client) -> None:
    response = client.get(path)

    assert response.status_code == 301
    assert response["Location"] == "https://karfansa.news.ir/"


def test_legacy_news_detail_does_not_redirect_without_an_exact_mapping(client: Client) -> None:
    response = client.get("/news/example-company/example-article/")

    assert response.status_code == 404
