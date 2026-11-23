# Contributing to verso

Thanks for your interest in contributing! Whether you're fixing a bug, improving OCR/inpainting fidelity, adding a stamp template, or polishing the UI, pull requests are welcome.

## Local Setup

1. Fork and clone the repository.
2. Install backend and frontend dependencies:
   ```bash
   make install
   ```
3. Start the dev servers in two terminals:
   ```bash
   make dev-backend   # http://127.0.0.1:8000
   make dev-frontend  # http://127.0.0.1:3003
   ```

No Appwrite account or API keys are required for local development — `verso` runs on an isolated local SQLite store in `backend/tmp/` automatically.

## Coding Standards

### Backend (Python 3.12 + FastAPI)
- Keep route handlers in `api.py` thin; put business logic in `service.py` or dedicated engine modules (`native_engine.py`, `scanned_engine.py`, `stamp_engine.py`).
- Every new/changed endpoint should enforce rate limiting and return clear `HTTPException` errors.
- Any persistence change must be implemented in **both** `SqliteWorkspaceRepository` and `AppwriteWorkspaceRepository` (`storage.py`).
- All code must pass `ruff check`, `pyright`, and `pytest`.

### Frontend (React 19 + TypeScript + Tailwind CSS v4)
- Strict TypeScript mode — avoid `any`; keep `frontend/src/types.ts` aligned with `backend/src/editpdf/models.py`.
- Keep every `.ts`/`.tsx` file in `frontend/src/` **strictly under 300 LOC**; colocate local UI state and use domain-scoped Contexts (`WorkspaceContext`, `EditorContext`, `DashboardContext`, `StampStudioContext`) instead of prop drilling.
- Use the semantic Tailwind v4 `@theme inline` tokens defined in `frontend/src/styles.css` (`bg-background`, `bg-shell`, `bg-card`, `bg-secondary`, `text-brand`, etc.) — avoid arbitrary hex color or font-size classes like `bg-[#...]`.
- Keep user-facing copy clean and generic for both PDFs and images (no internal jargon like `Appwrite`, `SQLite`, or `Local Dev Mode`).
- Never bypass client-side file validation in `frontend/src/lib/validation.ts` or route guards in `frontend/src/features/workspace/authGuard.ts`.

### Using AI Coding Agents
See [AGENTS.md](AGENTS.md) and `.agents/skills/` for repository-specific workflows, invariants, and skill guides.

## Before Opening a Pull Request

Run the full check suite and make sure everything passes cleanly:

```bash
make check
```

Keep PRs focused, include tests for backend engine/API changes, and never commit `.env` files or personal secrets.
