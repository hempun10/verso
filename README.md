# verso

**Edit text inside PDFs, scanned documents, and images in place — keeping original fonts, layouts, signatures, stamps, and Drive-style folders.**

`verso` is an open-source, self-hostable document studio built with **React 19 + TypeScript + Tailwind CSS v4** and **Python 3.12 + FastAPI + PyMuPDF + OpenCV + RapidOCR**.

---

## Features

- **Dual-Track Text Editing (Native PDF + Scanned / Image OCR)**
  - **Native PDFs**: Extracts embedded fonts (`fontTools`), matches metric-compatible system fonts, preserves rotation/baseline/colors, and redacts only edited spans without disturbing background graphics.
  - **Scanned PDFs & Images (PNG, JPG, WebP)**: Automatically runs OCR (`rapidocr-onnxruntime`), inpaints original ink cleanly (`cv2.inpaint`), matches local ink color/size/scan grain, and exports back to **PNG** or **PDF**.
  - **Inline Rich Text**: Partial-word bold, italic, underline, strikethrough, color, highlight, font family, and size overrides.
- **Government Stamp Studio**
  - Upload any logo, crest, or phone photo of a physical stamp — OpenCV removes the background (with flat-field illumination correction, engraved line-art mode, and GrabCut cutout), then compose circular, oval, or rectangular official seals with curved arc text and realistic rubber-ink grain at 60fps.
- **Signatures, Whiteout & Image Overlays**
  - Draw or type signatures, cover sensitive details with rectangle/ellipse whiteouts, crop/rotate/resize image overlays, and reuse saved assets across documents.
- **Drive-Style Dashboard & Sharing**
  - Nested folders, multi-file drag-and-drop uploads (up to 10 files per batch), right-click context menus, keyboard shortcuts (`N`, `U`, `⌘K`, `G`, `R`, `⌫`), storage usage tracking, auto-saved sessions, and revocable share links.
- **Production-Ready Security**
  - Pre-upload client & server magic-byte/size validation, per-browser signed `HttpOnly` guest cookies, HMAC-signed short-lived asset URLs, sliding-window rate limiting, optional Cloudflare Turnstile CAPTCHA, enforced storage quotas, bounded LRU caches, and security headers.

---

## Quick Start (Zero-Setup Local Mode)

Runs out of the box with local SQLite + disk storage — no external database or cloud keys required.

### Prerequisites
- **Python 3.12+** with [`uv`](https://docs.astral.sh/uv/)
- **Node.js 20+** with [`pnpm`](https://pnpm.io/)

### 1. Install dependencies
```bash
make install
# or manually:
# cd backend && uv sync
# cd frontend && pnpm install
```

### 2. Start backend & frontend (two terminals)
```bash
# Terminal 1 — FastAPI backend on http://127.0.0.1:8000
make dev-backend

# Terminal 2 — Vite frontend on http://127.0.0.1:3003
make dev-frontend
```

Open **http://127.0.0.1:3003** in your browser.

---

## Self-Hosting with Docker

Build and run both frontend and backend in a single container:

```bash
docker compose up --build
```

Then visit **http://localhost:8000**.

For production, set `EDITPDF_ENV=production`, a strong `EDITPDF_AUTH_SECRET` (>= 24 chars), `EDITPDF_ENABLE_DEV_AUTH=false`, and `EDITPDF_ALLOWED_ORIGINS=https://your-domain.com`.

---

## Optional: Appwrite Cloud Setup (OAuth + Cloud Storage)

To enable Google/GitHub OAuth and cloud persistence with [Appwrite](https://appwrite.io/):

1. Copy the environment templates:
   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```
2. Fill in `APPWRITE_ENDPOINT`, `APPWRITE_PROJECT_ID`, and `APPWRITE_API_KEY` in `backend/.env`.
3. Bootstrap the TablesDB tables, indexes, and Storage bucket automatically:
   ```bash
   cd backend && uv run python scripts/setup_appwrite.py
   ```

---

## Environment Variables

| Variable | Default | Description |
| :--- | :--- | :--- |
| `EDITPDF_ENV` | `development` | Set to `production` to enforce startup security guards & HSTS |
| `EDITPDF_AUTH_SECRET` | dev default | **Required in prod (>=24 chars)**. Signs guest cookies & asset URLs |
| `EDITPDF_ENABLE_DEV_AUTH` | auto | Local dev test login; **must be `false` in production** |
| `EDITPDF_ALLOWED_ORIGINS` | localhost | Comma-separated allowed CORS origins |
| `EDITPDF_TRUST_PROXY_HEADERS` | `false` | Set `true` behind Cloudflare / reverse proxy for real client IPs |
| `EDITPDF_MAX_PDF_BYTES` | `25000000` | Max uploaded PDF size in bytes (25 MB) |
| `EDITPDF_MAX_PDF_PAGES` | `50` | Max pages per uploaded PDF |
| `EDITPDF_MAX_IMAGE_BYTES` | `5000000` | Max image/stamp/signature size in bytes (5 MB) |
| `EDITPDF_STORAGE_QUOTA_BYTES` | `2000000000` | Per-user storage quota (2 GB) |
| `EDITPDF_RATE_LIMIT_ENABLED` | `true` | Toggle sliding-window API rate limiting |
| `TURNSTILE_SITE_KEY` / `SECRET_KEY` | *(empty)* | Optional Cloudflare Turnstile CAPTCHA keys |
| `APPWRITE_ENDPOINT` / `PROJECT_ID` / `API_KEY` | *(empty)* | Optional Appwrite Cloud persistence & OAuth |
| `VITE_API_BASE_URL` | *(empty)* | Optional frontend API origin for split deploys |

---

## Development & Checks

Run all linters, typecheckers, backend tests, and frontend production build in one command:

```bash
make check
```

Individual commands:
- Backend: `cd backend && uv run ruff check src tests && uv run pyright && uv run pytest -v`
- Frontend: `cd frontend && pnpm run typecheck && pnpm run build`

---

## Architecture & Contributing

- **Architecture Deep Dive**: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **Contributing Guide**: [CONTRIBUTING.md](CONTRIBUTING.md)
- **AI Agent Guidance & Skills**: [AGENTS.md](AGENTS.md) and `.agents/skills/`
- **Security Policy**: [SECURITY.md](SECURITY.md)

## License

MIT — see [LICENSE](LICENSE).
