from pathlib import Path

import pytest
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.core.errors import ApiError
from apps.core.slugs import build_unique_slug
from apps.core.uploads import UploadTo
from apps.core.validators import MAX_IMAGE_BYTES, validate_image_size
from apps.core.workflow import ensure_transition
from apps.organizations.models import Industry, Organization


def test_upload_path_ignores_the_client_file_name() -> None:
    path = UploadTo("organizations/logos")(Organization(), "../../evil name.PNG")

    assert path.startswith("organizations/logos/")
    assert path.endswith(".png")
    assert "evil" not in path
    assert ".." not in path
    assert len(Path(path).stem) == 32


def test_image_size_limit() -> None:
    validate_image_size(SimpleUploadedFile("ok.png", b"x" * 1024))

    with pytest.raises(ValidationError):
        validate_image_size(SimpleUploadedFile("big.png", b"x" * (MAX_IMAGE_BYTES + 1)))


def test_workflow_allows_listed_and_blocks_other_transitions() -> None:
    allowed = {"a": {"b"}}

    ensure_transition(current="a", target="b", allowed=allowed)
    with pytest.raises(ApiError) as exc:
        ensure_transition(current="a", target="c", allowed=allowed)

    assert exc.value.status_code == 409
    assert exc.value.code == "invalid_status_transition"


@pytest.mark.django_db
def test_slug_uses_first_ascii_candidate_and_numbers_duplicates() -> None:
    Industry.objects.create(name_fa="الف", slug="steel-works")

    assert build_unique_slug(Industry, "فولاد", "Steel Works", fallback="x") == "steel-works-2"
    assert build_unique_slug(Industry, "Brand New", fallback="x") == "brand-new"


@pytest.mark.django_db
def test_slug_falls_back_when_text_is_only_persian() -> None:
    slug = build_unique_slug(Industry, "فقط فارسی", fallback="company")

    assert slug.startswith("company-")
    assert len(slug) == len("company-") + 8
