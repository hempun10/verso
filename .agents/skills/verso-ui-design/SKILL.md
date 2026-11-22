---
name: verso-ui-design
description: >-
  Design system, visual tokens, component patterns, and copy guidelines for verso's
  dark UI (Landing page, Drive Dashboard, Document Editor, and Studio modals). Use when
  creating or styling React UI components in frontend/src/components/.
---

# verso UI Design System Skill

Follow these exact tokens and patterns so every page, toolbar, and modal feels cohesive.

## 1. Semantic Tailwind v4 Design Tokens (`frontend/src/styles.css`)

**Never hardcode arbitrary hex colors (`bg-[#...]`, `text-[#...]`, `border-[#...]`), arbitrary pixel font sizes (`text-[11px]`, `text-[13px]`), or arbitrary shadows in components.** Always use the semantic Tailwind v4 tokens defined in `@theme inline` inside `frontend/src/styles.css`:

| Role | Semantic Class | Underlying Token | Usage |
| :--- | :--- | :--- | :--- |
| App Canvas / Page BG | `bg-background` / `text-background` | `#08090a` | Outer shell, landing page, primary CTA text |
| Dashboard Outer Shell | `bg-shell` | `#0a0a0b` | Dashboard left sidebar backdrop |
| Preview Tile / Grid BG | `bg-canvas-tile` | `#0b0c0e` | Editor studio grid, file preview tiles |
| Elevated Panel | `bg-card` | `#0f1011` | Dashboard inset panel, cards, topbar |
| Interactive Surface | `bg-secondary` / `bg-popover` | `#141516` | Inputs, folder cards, menus, dropzones |
| Subtle Hover | `hover:bg-surface-hover` | `#1a1b1f` | Card & row hover backgrounds |
| Active / Hover Surface | `bg-accent` / `bg-surface-active` | `#1c1d1f` / `#232428` | Menu hover, active pill, segmented toggles |
| Subtle / Strong Border | `border-border` / `border-input` | `#1f2023` / `#2a2b2f` | Panel dividers, dialogs, dashed dropzones |
| Hover Border | `hover:border-border-hover` | `#3f4149` | Dropzone hover outline |
| Primary Text | `text-foreground` | `#f7f8f8` | Headings, active labels |
| Strong / Subtle Text | `text-strong-foreground` / `text-subtle-foreground` | `#d4d4d8` / `#a1a1aa` | Body copy, menu items, icons |
| Muted / Dim Text | `text-muted-foreground` / `text-dim-foreground` | `#8a8f98` / `#62666d` | Metadata, hints, keyboard badges, timestamps |
| Primary Accent | `bg-brand` / `text-brand` / `border-brand` / `accent-brand` | `#7170ff` | Active nav pill, focus rings, drop highlights, spinners |
| Soft Accent | `text-brand-soft` | `#9a99ff` | Subtle accent links & highlights |
| Success / Warning | `text-success` / `bg-success` / `bg-warning` | `#3ecf8e` / `#f2b53d` | Saved indicator, completed upload, storage warning |
| Destructive / Danger | `text-destructive` / `bg-destructive` / `text-danger-text` | `#e0705f` / `#f7d8d2` | Delete actions, error banners |
| Paper Preview / CTA | `bg-paper` / `hover:bg-cta-hover` / `active:bg-cta-active` | `#f8f7f3` / `#f4f4f6` / `#e8e8ec` | Stamp paper backdrop, high-contrast white CTA buttons |

### Typography, Shadows & Patterns
- **Type scale**: Use canonical classes (`text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`) and `@theme` UI tokens (`text-3xs`, `text-2xs`, `text-label`, `text-body-sm`, `text-body-md`, `text-title-md`, `text-hero`).
- **Shadows**: Use `shadow-floating`, `shadow-menu`, `shadow-canvas`, `shadow-dialog`, `shadow-cta`, `shadow-cta-lg`, `shadow-raised`, `shadow-inset-badge`.
- **Patterns**: Use `.bg-checkerboard`, `.bg-landing-stripes`, `.bg-landing-dots`, `.bg-hero-glow`, `.bg-cta-glow` from `styles.css`.
- **Spacing**: Use Tailwind v4's canonical spacing scale (`h-14`, `w-62`, `top-16.5`, `max-w-45`, `min-w-11`, `z-15`) instead of pixel brackets (`h-[56px]`, `top-[66px]`).

## 2. Typography & Spacing

- Font stack: `Geist` (`font-sans`) for UI copy and `Geist Mono` (`font-mono`) for shortcuts, file sizes, hex codes, and dimensions.
- Always apply `tabular-nums` to counters, byte sizes, zoom percentages, and timestamps.
- Keep dialogs dark-themed via shadcn primitives (`DialogContent`, `Input`, `Button`, `Tabs`) without introducing raw light-mode `bg-white` dialog shells (only the PDF/paper canvas preview itself uses a white paper surface).

## 3. Radix Portal & Interactive Pitfalls

- **Portal-mounted `<canvas>`**: Radix `DialogContent` mounts inside a Portal *after* `open` becomes `true`. Never rely on `useRef` alone in a `useEffect([open])` to draw onto a canvas inside a Dialog — use a callback ref (`const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null)` + `<canvas ref={setCanvasEl} />`) so drawing runs reliably the instant the Portal mounts.
- **Keyboard Shortcut Guards**: Any new modal dialog state MUST be added to `anyDialogOpen` in `frontend/src/App.tsx` so single-key editor shortcuts (`V`, `W`, `G`, `I`, `B`, `R`, `Backspace`) never fire while typing in inputs or interacting with modals.
- **Loading States**: Async actions that mutate workspace state (moving files, deleting, uploading, extracting stamps) must display inline spinners (`Loader2 animate-spin`) and disable duplicate submissions.

## 4. User-Facing Copy Rules

- Keep copy crisp, friendly, and non-technical.
- Never leak backend vendor/internal names (`Appwrite`, `SQLite`, `RapidOCR`, `Local Dev Mode`, `non-realtime`) into visible UI text.
- Remember users upload both **PDFs and images (PNG/JPG/WebP)**: use `"Upload file"` / `"Move file"` / content-aware loading text (`"Uploading and analyzing image..."` vs `"Uploading and analyzing PDF..."`).
