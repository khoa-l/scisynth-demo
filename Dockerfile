# One image: the frontend is built to static files and served by the backend.
FROM node:22-slim AS frontend
RUN corepack enable
WORKDIR /frontend
COPY frontend/package.json frontend/pnpm-lock.yaml frontend/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY frontend ./
RUN pnpm generate

FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY backend ./
COPY --from=frontend /frontend/.output/public /app/public
ENV FRONTEND_DIR=/app/public SCISYNTH_DB=/data/scisynth.db
CMD uv run --no-sync uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
