---
name: verso-ui-design
description: >-
  Design system, visual tokens, component patterns, and copy guidelines for verso's
  dark UI (Landing page, Drive Dashboard, Document Editor, and Studio modals). Use when
  creating or styling React UI components in frontend/src/components/.
---

# verso UI Design System Skill

Follow these exact tokens and patterns so every page, toolbar, and modal feels cohesive.

## 1. Color Palette (Dark-First Surface Hierarchy)

| Role | Token / Hex | Usage |
| :--- | :--- | :--- |
| App Canvas / Page BG | `#08090a` / `bg-background` | Outer shell, landing page, editor backdrop |
| Elevated Panel | `#0f1011` / `bg-card` | Dashboard inset panel, cards, topbar |
| Interactive Surface | `#141516` / `bg-secondary` | Inputs, folder cards, menus, dropzones |
| Hover / Active Surface | `#1c1d1f` / `#232428` | Menu hover, active pill, segmented toggles |
| Subtle Border | `#1f2023` / `border-border` | Panel dividers, card outlines |
| Strong Border | `#2a2b2f` / `border-input` | Dialogs, popovers, dashed dropzones |
| Primary Text | `#f7f8f8` / `text-foreground` | Headings, active labels |
| Secondary Text | `#a1a1aa` / `#8a8f98` | Descriptions, metadata, icons |
| Muted Text | `#62666d` | Hints, keyboard badges, timestamps |
| Primary Accent | `#7170ff` | Active nav pill, focus rings, drop highlights, spinners |
| Success | `#3ecf8e` | Saved indicator, completed upload, copied state |
| Destructive | `#e0705f` | Delete actions, error banners |
| Primary CTA Button | `bg-white text-[#08090a] hover:bg-[#f4f4f6]` | High-contrast white pill/button on dark surfaces |

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
