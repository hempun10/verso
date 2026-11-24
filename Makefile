.PHONY: install fetch-ocr-models dev-backend dev-frontend test check docker-up

install:
	cd backend && uv sync
	cd frontend && pnpm install
	backend/.venv/bin/python scripts/prepare_ocr_models.py

fetch-ocr-models:
	backend/.venv/bin/python scripts/prepare_ocr_models.py

dev-backend:
	cd backend && uv run uvicorn editpdf.api:app --reload --port 8000

dev-frontend:
	cd frontend && pnpm dev --host 127.0.0.1 --port 3003

test:
	cd backend && uv run pytest -v

check:
	cd backend && uv run ruff check src tests && uv run pyright && uv run pytest -v
	cd frontend && pnpm run typecheck && pnpm run build

docker-up:
	docker compose up --build
