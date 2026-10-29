from celery import shared_task


@shared_task(name="core.ping")  # type: ignore[untyped-decorator]  # celery ships no type hints
def ping() -> str:
    """Smoke-test task proving that the worker, broker and result backend are wired."""
    return "pong"
