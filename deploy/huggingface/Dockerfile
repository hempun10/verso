# Backend-only production Dockerfile for Hugging Face Spaces (Docker SDK).
# Runs as non-root uid=1000 on port 7860 with PyMuPDF, OpenCV, and RapidOCR.
FROM python:3.12-slim

# System libraries for OpenCV headless, PyMuPDF, and metric-compatible PDF fallback fonts
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    fonts-liberation \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

# Hugging Face Spaces runs containers as uid 1000
RUN useradd -m -u 1000 user
WORKDIR /app/backend

# Install uv and Python dependencies as root, then hand ownership to uid 1000
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev

COPY backend/src ./src
COPY backend/scripts ./scripts
RUN mkdir -p /app/backend/data /tmp/.cache && chown -R 1000:1000 /app /tmp/.cache

USER user

ENV HOME=/home/user \
    PATH="/app/backend/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    XDG_CACHE_HOME=/tmp/.cache \
    TMPDIR=/tmp \
    PORT=7860

EXPOSE 7860

CMD ["sh", "-c", "uvicorn editpdf.api:app --host 0.0.0.0 --port ${PORT:-7860} --workers 1 --proxy-headers --forwarded-allow-ips='*'"]
