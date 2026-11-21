# AGENTS.md — Repository Guide for AI Coding Agents

This file gives AI coding assistants the architecture map, commands, invariants, and conventions for working safely and effectively in **verso** (`editpdf`).

## Repository Map

- `backend/` — Python 3.12+ FastAPI API & document engines (`uv` + `pyproject.toml`)
  - `src/editpdf/api.py`: Thin HTTP routes, CORS, security headers, per-browser guest cookie middleware, rate limits, CAPTCHA, optional SPA static mount (`EDITPDF_STATIC_DIR`)
  - `src/editpdf/service.py`: `SessionStore` orchestration, bounded LRU RAM/disk caches, OCR/render concurrency semaphore, storage quota enforcement
  - `src/editpdf/classifier.py`: Per-page native vs. scanned PDF classifier
  - `src/editpdf/native_engine.py`: Vector PDF text extraction, embedded font `cmap` checking, background-sampled redaction, styled re-insertion
  - `src/editpdf/scanned_engine.py`: `RapidOCR` text extraction, OpenCV inpainting, scan-matched text rendering
  - `src/editpdf/stamp_engine.py`: OpenCV background removal & pixel capture (`ink`, `engraved`, `cutout`)
  - `src/editpdf/overlays.py`: Whiteout shapes and rotated/cropped image/signature/stamp overlays
  - `src/editpdf/storage.py`: `WorkspaceRepository` protocol with `SqliteWorkspaceRepository` and `AppwriteWorkspaceRepository`
  - `src/editpdf/auth.py`: Appwrite JWT verification, HMAC signed guest cookies (`verso_guest`), HMAC short-lived asset URL signing, dev tokens
  - `src/editpdf/security.py`: Sliding-window rate limiter, Cloudflare Turnstile verifier, magic-byte validators
  - `src/editpdf/config.py`: Env-driven `Settings` + production startup guards
  - `src/editpdf/models.py`: Pydantic v2 schemas (keep aligned with `frontend/src/types.ts`)
  - `tests/`: Pytest suite covering engines, overlays, folders, images, stamps, security, and production hardening
- `frontend/` — React 19 + TypeScript + Vite + Tailwind CSS v4 + shadcn/ui (`pnpm`) — every `.ts`/`.tsx` module is kept **strictly under 300 LOC** using a Bulletproof React feature-first architecture with colocated local state and domain Contexts (zero prop drilling):
  - `src/App.tsx`: Thin view router (`AppProviders` → `EditorWorkspace` / `DashboardPage` / `LandingPage`)
  - `src/app/AppProviders.tsx`: Composes `TooltipProvider`, `WorkspaceProvider`, `EditorProvider`, and global/editor `EditorModals`
  - `src/api/` (`client.ts`, `auth.ts`, `documents.ts`, `folders.ts`, `assets.ts`, barrel `src/api.ts`): `apiFetch` wrapper (`credentials: "include"`, 11-min JWT auto-refresh, 401 single retry, `VITE_API_BASE_URL`)
  - `src/features/` — Domain-scoped Context providers, hooks, sub-components, and selectors:
    - `features/workspace/`: `WorkspaceContext` (`WorkspaceProvider`, `useWorkspace`), `types.ts`
    - `features/editor/`: `EditorContext` (`EditorProvider`, `useEditor`), `EditorWorkspace`, `EditorTopbar`, `EditorDocMenu`, `EditorToolGroup`, `EditorAccountMenu`, `EditorInspectors`, `EditorCanvas`, `InlineTextEditor`, `EditorBottomBar`, `EditorModals`, `TextStyleControls`, `ImageInspectorControls`, `useDocumentSession`, `usePageLoader`, `useUploadFlow`, `useEditorActions`, `useOverlayActions`, `useAssetPlacement`, `useEditorShortcuts`, plus `overlay-layer/` (`geometry.ts`, `useOverlayInteractions.ts`, `CropModeOverlay.tsx`, `OverlayItem.tsx`)
    - `features/dashboard/`: Feature-scoped `DashboardContext` (`DashboardProvider`, `useDashboard`), `DashboardSidebar`, `SidebarFolderTree`, `DashboardHeader`, `DashboardCanvas`, `DashboardEmptyStates`, `FolderGrid`, `FileViews`, `DashboardContextMenu`, `DashboardModals`, `selectors.ts`, `types.ts`
    - `features/landing/`: `LandingHeader`, `LandingHero`, `LandingSections`, `LandingFooter`, `FeatureVisuals`, `primitives.tsx`
    - `features/stamp/`: Feature-scoped `StampStudioContext` (`StampStudioProvider`, `useStampStudio`), `StampPreviewPane`, `StampControlsPane`, `StampExtractControls`, `useStampExtraction`
    - `features/signature/`: `SignatureTabs`, `renderSignature.ts`
  - `src/hooks/`: Reusable portable hooks — `useHistory`, `useWindowFileDrop`, `useWindowKeyDown`, `useDebouncedAutoSave`, `useScrolled`
  - `src/lib/`: `auth.ts`, `validation.ts`, `format.ts`, `canvas.ts`, `dom.ts`, `utils.ts`, modular `runs/` (`model.ts`, `dom.ts`) + barrel `runs.ts`, modular `stamp/` (`types.ts`, `primitives.ts`, `distress.ts`, `seals.ts`, `render.ts`) + barrel `stampRenderer.ts`
  - `src/components/ui/`: shadcn primitives + reusable `AlertBanner`, `ColorSwatchPicker`, `EmptyState`, `FileDropOverlay`, `FileTypeIcon`/`FileTypeBadge`, `GoogleIcon`/`GitHubIcon`
  - `src/components/`: Thin top-level shells & modals — `LandingPage.tsx`, `DashboardPage.tsx`, `OverlayLayer.tsx`, `InspectorBar.tsx`, `OverlayInspectorBar.tsx`, `StampStudioDialog.tsx`, `ImageLibraryDialog.tsx`, `SignaturePadDialog.tsx`, `AuthDialog.tsx`, `WorkspaceDialogs.tsx`, `LegalDialog.tsx`, `ShortcutsDialog.tsx`, `UploadQueueToast.tsx`, `ErrorBoundary.tsx`, `BrandLogo.tsx`
- `.agents/skills/` — On-demand domain skills (load before making substantial changes in their area):
  - `verso-ui-design`: Dark UI palette, Radix/shadcn patterns, copy rules
  - `react-typescript-best-practices`: React 19 + strict TypeScript + Canvas/API patterns
  - `python-fastapi-engine`: FastAPI, PyMuPDF, OpenCV, dual-repository parity, testing

## Essential Commands

```bash
# Backend checks (run inside backend/)
uv run ruff check src tests
uv run pyright
uv run pytest -v

# Frontend checks (run inside frontend/)
pnpm run typecheck
pnpm run build

# Everything at once (from repo root)
make check
```

> **Tip**: In offline/sandboxed environments, use `uv run --no-sync ...` so `uv` uses the existing `.venv` without network calls.

## Non-Negotiable Invariants

1. **Immutable Source PDFs**: Never mutate the original uploaded PDF in place. Always replay `edits` and `overlays` on a fresh open of the original file.
2. **Dual Storage Parity**: Any schema or query change in `storage.py` MUST be implemented in both `SqliteWorkspaceRepository` and `AppwriteWorkspaceRepository` (and mirrored in `backend/scripts/setup_appwrite.py` when adding Appwrite columns).
3. **Strict Schema Sync**: Whenever modifying Pydantic request/response models in `backend/src/editpdf/models.py`, update the matching TypeScript interfaces in `frontend/src/types.ts`.
4. **Security & Isolation**:
   - Never weaken per-browser guest cookie isolation (`verso_guest`) or signed asset URL verification (`GET /api/assets/{id}/content`).
   - Never expose test/dev login UI in production builds (must remain gated by `import.meta.env.DEV && authConfig?.dev_login_enabled` on frontend and `EDITPDF_ENABLE_DEV_AUTH=false` + startup guard on backend).
   - Never commit `.env` files, API keys, or real user data.
5. **Content-Aware Copy**: `verso` edits both PDFs and images (PNG/JPG/WebP). Avoid hardcoded `"PDF"` copy where generic `"file"` or content-aware wording applies, and keep internal backend names (`Appwrite`, `SQLite`, `Local Dev Mode`) out of end-user UI.
