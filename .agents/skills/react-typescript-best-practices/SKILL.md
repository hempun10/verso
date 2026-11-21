---
name: react-typescript-best-practices
description: >-
  React 19, strict TypeScript, API auth/fetching, client-side validation, and Canvas 2D
  best practices for frontend/src/. Use when writing or refactoring React hooks,
  state management, API clients, or interactive canvas components.
---

# React 19 + TypeScript Best Practices (verso Frontend)

## 1. State Colocation, Domain Contexts & `< 300 LOC` Rule

- **Colocate state first**: If a piece of UI state is only used by one component (e.g. `docMenuOpen` in `EditorDocMenu`, `newMenuOpen` in `DashboardSidebar`, `expanded` in `SidebarFolderTree`, `previewPaper` in `StampPreviewPane`, `openFaq` in `LandingSections`), keep `useState` inside that component — never lift it to `App.tsx` or a parent context.
- **Avoid prop drilling with Domain Contexts (React 19 `<Context value={...}>`)**:
  - `WorkspaceProvider` (`features/workspace/WorkspaceContext.tsx`): auth, user, saved docs/folders/assets/storage, navigation view, global error, global modals.
  - `EditorProvider` (`features/editor/EditorContext.tsx`): active document session, undo/redo history, editor actions/selection, uploads + hidden file input, editor modals, shortcuts.
  - Feature-local providers (`DashboardProvider`, `StampStudioProvider`): mounted ONLY at the feature boundary so state resets/unmounts cleanly when leaving the feature.
  - Keep `App.tsx` ultra-thin (`AppProviders` → view router with 0 props passed to pages).
- **Keep every `.ts` and `.tsx` file under 300 LOC** and avoid bloated prop lists (>8 props). Split pure logic/selectors, hooks, presentational sub-components, and shared UI primitives (`src/components/ui/`).

## 2. Strict TypeScript & Discriminated Unions

- Keep `tsc --noEmit` and `tsc -b` 100% clean. Never introduce `any` or `@ts-ignore`.
- Keep `frontend/src/types.ts` strictly aligned with `backend/src/editpdf/models.py`.
- When deriving helper types from discriminated unions (e.g. `PageOverlay`, `ContextMenuState`), define the base union first and intersect shared fields (`type MenuState = MenuTarget & { x: number; y: number }`) instead of using `Omit<Union, ...>`, which collapses discriminated narrowing in TypeScript.

## 3. Network, Auth & File Validation

- **Always use `apiFetch` in `frontend/src/api/client.ts` (re-exported from `frontend/src/api.ts`)** (never raw `fetch("/api/...")` directly in components). `apiFetch` automatically:
  - resolves `VITE_API_BASE_URL` via `apiUrl(...)`,
  - sends `credentials: "include"` for isolated per-browser guest cookies,
  - proactively refreshes Appwrite JWTs before their 15-minute expiry,
  - retries once on `401` after forcing a fresh JWT.
- **Validate files before network upload**: Always run `validateDocumentFileClient` or `validateImageFileClient` (`frontend/src/lib/validation.ts`) before `FormData` upload so invalid magic bytes or oversized files fail instantly with 0 bytes sent.
- **Production Bundle Hygiene**: Gate any local-only dev UI behind `import.meta.env.DEV` so Vite tree-shakes it completely out of `dist/`.

## 4. Effect Hygiene & Reusable Hooks / Utilities

- **Avoid unnecessary `useEffect`**: Never use `useEffect` to reset modal state when `open` changes or to derive state from props — reset state in `onOpenChange` handlers, initialize from props on conditional mount (`{open && <Dialog ... />}`), and derive values during render or with `useMemo`. Only use `useEffect` to synchronize with genuine external systems (network requests, DOM/window events, timers, Canvas 2D, third-party SDKs).
- **Reuse existing portable hooks (`frontend/src/hooks/`)** instead of re-implementing listeners inline:
  - `useHistory<T>` — atomic undo/redo stack
  - `useWindowKeyDown` — latest-ref window keydown subscription (binds once, zero dependency churn)
  - `useWindowFileDrop` — depth-tracked OS file drag-and-drop
  - `useDebouncedAutoSave` — dirty-checked debounced persistence
  - `useScrolled` — passive scroll-threshold state
- **Reuse shared pure utilities (`frontend/src/lib/`)** & **UI primitives (`frontend/src/components/ui/`)**:
  - `format.ts` (`formatBytes`, `formatRelativeTime`, `stripFileExtension`, `readFileAsDataUrl`, `triggerDownload`)
  - `canvas.ts` (`cropCanvasToTrimmedPng`)
  - `dom.ts` (`isEditableTarget`)
  - `AlertBanner`, `ColorSwatchPicker`, `EmptyState`, `FileDropOverlay`, `FileTypeIcon`, `FileTypeBadge`, `GoogleIcon`, `GitHubIcon`

## 5. Performance & Memory Hygiene

- **Code-splitting**: Heavy secondary views and modals (`DashboardPage`, `StampStudioDialog`, `SignaturePadDialog`, `ImageLibraryDialog`, `ShortcutsDialog`, `LegalDialog`) should stay lazy-loaded with `React.lazy` + `Suspense`.
- **Object URLs**: Always `URL.revokeObjectURL(...)` in `useEffect` cleanup or `finally` blocks when creating blob preview URLs to avoid memory leaks during page navigation.
- **No Page-Switch Flicker**: Wait until the new page preview `<img>` finishes loading (`onLoad` / matching `preview.key === currentPageKey`) before rendering text hitboxes or overlays on top of it.
- **Bounded Concurrency**: For multi-file uploads or batch operations, cap concurrent requests (currently concurrency = 2) so users stay under API rate limits.

## 6. Verification Before Finishing

Run from `frontend/`:
```bash
pnpm run typecheck && pnpm run build
```
