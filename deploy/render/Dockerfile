# Backend-only production Dockerfile tuned for Render Free (512 MB RAM).
# Runs as non-root uid=1000 with memory-conservative glibc/OpenMP settings.
FROM python:3.12-slim

# System libraries for OpenCV headless, PyMuPDF, and metric-compatible PDF fallback fonts
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    fonts-liberation \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -m -u 1000 user
WORKDIR /app/backend

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY backend/src ./src
COPY backend/scripts ./scripts
RUN uv sync --frozen --no-dev \
    && mkdir -p /app/backend/data /app/backend/tmp/sessions /tmp/.cache \
    && chown -R 1000:1000 /app /tmp/.cache

USER user

ENV HOME=/home/user \
    PATH="/app/backend/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    XDG_CACHE_HOME=/tmp/.cache \
    TMPDIR=/tmp \
    MALLOC_ARENA_MAX=2 \
    OMP_NUM_THREADS=1 \
    OPENBLAS_NUM_THREADS=1 \
    PORT=10000

EXPOSE 10000

CMD ["sh", "-c", "uvicorn editpdf.api:app --host 0.0.0.0 --port ${PORT:-10000} --workers 1 --proxy-headers --forwarded-allow-ips='*'"]
