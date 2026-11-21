# Stage 1: Build the React + Vite frontend
FROM node:22-slim AS frontend-builder
WORKDIR /app/frontend
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY frontend/package.json frontend/pnpm-lock.yaml frontend/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY frontend/ ./
RUN pnpm run build

# Stage 2: Production Python 3.12 + FastAPI + static SPA server
FROM python:3.12-slim AS runtime
WORKDIR /app/backend

# System libraries for OpenCV headless, PyMuPDF, and metric-compatible PDF fallback fonts
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    fonts-liberation \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

# Install uv and Python dependencies
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev

COPY backend/src ./src
COPY backend/scripts ./scripts
COPY --from=frontend-builder /app/frontend/dist /app/static

ENV EDITPDF_STATIC_DIR=/app/static
ENV PYTHONUNBUFFERED=1
EXPOSE 8000

CMD ["uv", "run", "--no-sync", "uvicorn", "editpdf.api:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
