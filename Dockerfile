# syntax=docker/dockerfile:1

FROM ghcr.io/voidzero-dev/vite-plus:1.4.0 AS frontend
WORKDIR /app
COPY --chown=vp:vp package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --chown=vp:vp apps/frontend/package.json apps/frontend/
COPY --chown=vp:vp apps/backend/package.json apps/backend/
RUN vp install --frozen-lockfile
COPY --chown=vp:vp . .
RUN cd apps/frontend && vp build

FROM python:3.14-slim-trixie AS backend
COPY --from=ghcr.io/astral-sh/uv:0.13.6 /uv /uvx /bin/
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_NO_DEV=1 \
    UV_PYTHON_DOWNLOADS=0
WORKDIR /app
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=apps/backend/uv.lock,target=uv.lock \
    --mount=type=bind,source=apps/backend/pyproject.toml,target=pyproject.toml \
    uv sync --locked --no-install-project
COPY apps/backend/ .

FROM python:3.14-slim-trixie
WORKDIR /app
COPY --from=backend /app /app
COPY --from=frontend /app/apps/frontend/dist /app/static
RUN mkdir -p /data
ENV PATH="/app/.venv/bin:$PATH" \
    FRONTEND_DIR=/app/static \
    DATABASE_URL=sqlite:////data/scisynth.db \
    COOKIE_SECURE=true
CMD ["sh", "-c", "alembic upgrade head && fastapi run app/main.py --port ${PORT:-8000}"]
