# Backend-only production Dockerfile for AWS Lambda Container Image + Lambda Web Adapter.
# Scales to zero ($0 when idle), ~2-4s cold start, 2 GB RAM, read-only rootfs with /tmp writable.
FROM python:3.12-slim

# System libraries for OpenCV headless, PyMuPDF, and metric-compatible PDF fallback fonts
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    fonts-liberation \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

# AWS Lambda Web Adapter runs FastAPI/uvicorn natively behind a Lambda Function URL
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /lambda-adapter /opt/extensions/lambda-adapter

WORKDIR /app/backend

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY backend/src ./src
COPY backend/scripts ./scripts
RUN uv sync --frozen --no-dev && chmod -R a+rX /app/backend

ENV HOME=/tmp \
    PATH="/app/backend/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    XDG_CACHE_HOME=/tmp/.cache \
    TMPDIR=/tmp \
    EDITPDF_SESSIONS_DIR=/tmp/verso-sessions \
    AWS_LWA_PORT=8080 \
    AWS_LWA_READINESS_CHECK_PATH=/api/health \
    AWS_LWA_READINESS_CHECK_PORT=8080

EXPOSE 8080

CMD ["uvicorn", "editpdf.api:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1", "--proxy-headers", "--forwarded-allow-ips=*"]
