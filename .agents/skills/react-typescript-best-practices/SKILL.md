---
name: react-typescript-best-practices
description: >-
  React 19, strict TypeScript, API auth/fetching, client-side validation, and Canvas 2D
  best practices for frontend/src/. Use when writing or refactoring React hooks,
  state management, API clients, or interactive canvas components.
---

# React 19 + TypeScript Best Practices (verso Frontend)

## 1. Strict TypeScript & Discriminated Unions

- Keep `tsc --noEmit` and `tsc -b` 100% clean. Never introduce `any` or `@ts-ignore`.
- Keep `frontend/src/types.ts` strictly aligned with `backend/src/editpdf/models.py`.
- When deriving helper types from discriminated unions (e.g. `PageOverlay`, `ContextMenuState`), define the base union first and intersect shared fields (`type MenuState = MenuTarget & { x: number; y: number }`) instead of using `Omit<Union, ...>`, which collapses discriminated narrowing in TypeScript.

## 2. Network, Auth & File Validation

- **Always use `apiFetch` in `frontend/src/api.ts`** (never raw `fetch("/api/...")` directly in components). `apiFetch` automatically:
  - resolves `VITE_API_BASE_URL` via `apiUrl(...)`,
  - sends `credentials: "include"` for isolated per-browser guest cookies,
  - proactively refreshes Appwrite JWTs before their 15-minute expiry,
  - retries once on `401` after forcing a fresh JWT.
- **Validate files before network upload**: Always run `validateDocumentFileClient` or `validateImageFileClient` (`frontend/src/lib/validation.ts`) before `FormData` upload so invalid magic bytes or oversized files fail instantly with 0 bytes sent.
- **Production Bundle Hygiene**: Gate any local-only dev UI behind `import.meta.env.DEV` so Vite tree-shakes it completely out of `dist/`.

## 3. Performance & Memory Hygiene

- **Code-splitting**: Heavy secondary views and modals (`DashboardPage`, `StampStudioDialog`, `SignaturePadDialog`, `ImageLibraryDialog`, `ShortcutsDialog`, `LegalDialog`) should stay lazy-loaded with `React.lazy` + `Suspense`.
- **Object URLs**: Always `URL.revokeObjectURL(...)` in `useEffect` cleanup or `finally` blocks when creating blob preview URLs to avoid memory leaks during page navigation.
- **No Page-Switch Flicker**: Wait until the new page preview `<img>` finishes loading (`onLoad` / matching `preview.key === currentPageKey`) before rendering text hitboxes or overlays on top of it.
- **Bounded Concurrency**: For multi-file uploads or batch operations, cap concurrent requests (currently concurrency = 2) so users stay under API rate limits.

## 4. Verification Before Finishing

Run from `frontend/`:
```bash
pnpm run typecheck && pnpm run build
```
