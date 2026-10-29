# syntax=docker/dockerfile:1

# ---- base: Python + uv + non-root user -----------------------------------------------------
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_PROJECT_ENVIRONMENT=/opt/venv \
    UV_LINK_MODE=copy \
    PATH="/opt/venv/bin:$PATH"

RUN pip install --no-cache-dir uv==0.11.7 \
    && groupadd --system --gid 1000 app \
    && useradd --system --uid 1000 --gid app --create-home app \
    && mkdir -p /opt/venv /app \
    && chown -R app:app /opt/venv /app

WORKDIR /app
USER app

# ---- dev: all dependencies, source is bind-mounted by docker compose -----------------------
FROM base AS dev

COPY --chown=app:app pyproject.toml uv.lock ./
RUN uv sync --frozen

EXPOSE 8000
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]

# ---- prod: runtime dependencies only, source baked in --------------------------------------
FROM base AS prod

COPY --chown=app:app pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY --chown=app:app . .

ENV DJANGO_SETTINGS_MODULE=config.settings.production
EXPOSE 8000
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3", \
     "--access-logfile", "-", "--timeout", "60"]
