---
name: python-fastapi-engine
description: >-
  Python 3.12, FastAPI, PyMuPDF, OpenCV, RapidOCR, security, and dual SQLite/Appwrite
  repository best practices for backend/. Use when modifying API endpoints, PDF/image
  editing engines, stamp extraction, auth, or persistence.
---

# Python 3.12 + FastAPI Document Engine Skill (verso Backend)

## 1. Layered Architecture & Boundaries

- **`api.py` stays thin**: Validate HTTP params, call `enforce_rate_limit(...)` / `enforce_captcha(...)`, delegate to `SessionStore` or engine functions, and map domain errors cleanly:
  - `KeyError` -> `404`
  - `PermissionError` -> `403` (or `401` in `current_user`)
  - `OverflowError` -> `413`
  - `ValueError` -> `400`
- **`service.py` owns orchestration**: Enforces access control (`_check_access`), storage quotas (`_enforce_storage_quota`), LRU RAM/disk cache bounds (`_put_cache_entry`), and CPU concurrency semaphore (`self._heavy_sem`) around OCR/rendering.
- **Engines are pure & testable**: `native_engine.py`, `scanned_engine.py`, `stamp_engine.py`, `overlays.py`, and `classifier.py` should not depend on FastAPI `Request`/`Response` objects.

## 2. Security & Reliability Invariants

- **Bounded Streaming Reads**: Never `await file.read()` unbounded — always read `max_bytes + 1` so oversized payloads reject before buffering huge memory.
- **Magic-Byte Validation**: Always validate uploaded PDFs (`%PDF`) and images (PNG/JPEG/WebP signatures) via `security.py`, never trusting file extensions or `Content-Type` headers alone.
- **Asset Privacy**: Always return short-lived HMAC-signed URLs (`AuthService.sign_asset_url`) for saved assets and document image overlays; strip ephemeral `asset_url` and redundant `data_url` before saving state to DB.
- **Production Startup Safety**: `Settings.validate_for_startup()` must keep failing fast if `EDITPDF_ENV=production` with `dev_login_enabled=True` or a weak/default `auth_secret`.
- **Resource Caps**: Keep `self._cache` (LRU `OrderedDict`), `pdf_cache/` disk eviction, `AuthService._jwt_cache`, and `SlidingWindowRateLimiter` key pruning bounded.

## 3. Dual Storage Parity (`storage.py`)

- Every persistence method on `WorkspaceRepository` must work identically on:
  1. `SqliteWorkspaceRepository` (local/self-hosted, auto-migrating columns cleanly via `PRAGMA table_info`), and
  2. `AppwriteWorkspaceRepository` (cloud TablesDB + Storage, using `_list_all_rows` cursor pagination so results never truncate at Appwrite's 25-row default).
- When adding a new Appwrite column, update `backend/scripts/setup_appwrite.py` AND handle missing columns gracefully during rollout.

## 4. Testing & Code Quality

- Use `SessionStore(root_dir=tmp_path)` + `create_app(store=store)` in `pytest` tests so tests are fast, hermetic, and never touch live Appwrite Cloud.
- Keep lines <= 100 chars (`ruff`), strict typing (`pyright`), and run all three checks before finishing:
```bash
cd backend
uv run --no-sync ruff check src tests
uv run --no-sync pyright
uv run --no-sync pytest -v
```
