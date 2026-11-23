# verso

[![CI](https://github.com/hempun10/verso/actions/workflows/ci.yml/badge.svg)](https://github.com/hempun10/verso/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Edit text inside PDFs, scanned documents, and images in place — keeping original fonts, layouts, signatures, stamps, and Drive-style folders.**

**Live App**: [tryverso.pages.dev](https://tryverso.pages.dev)

`verso` is an open-source, self-hostable document studio built with **React 19 + TypeScript + Tailwind CSS v4** (modular feature-first architecture) and **Python 3.12 + FastAPI + PyMuPDF + OpenCV + RapidOCR**.

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
- **Protected Drive-Style Workspace & Sharing**
  - Sign-in protected dashboard and editor routes (Google & GitHub OAuth via Appwrite Cloud, with local dev accounts in dev mode), nested folders, multi-file drag-and-drop uploads, right-click context menus, keyboard shortcuts (`N`, `U`, `⌘K`, `G`, `R`, `⌫`), storage usage tracking, auto-saved sessions, and revocable share links.
- **Production-Ready Security**
  - Pre-upload client & server magic-byte/size validation, cross-site `HttpOnly` cookie hardening (`SameSite=None; Secure`), HMAC-signed short-lived asset URLs, sliding-window rate limiting, Cloudflare Turnstile CAPTCHA, enforced storage quotas, bounded LRU caches, and strict production startup guards.

---

## Quick Start (Local Development)

Runs out of the box with local SQLite + disk storage and local dev sign-in — no external database or cloud keys required.

### Prerequisites
- **Python 3.12+** with [`uv`](https://docs.astral.sh/uv/)
- **Node.js 22+** with [`pnpm`](https://pnpm.io/)

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

Open **http://127.0.0.1:3003** in your browser and sign in with a local dev account.

---

## Deployment & Self-Hosting

- **Serverless Production Stack (Cloudflare Pages + AWS Lambda Container + Appwrite Cloud)**:
  - Frontend deploys to Cloudflare Pages (`frontend/public/_redirects` for SPA routing) with automatic cold-start wake retries (`ServerWakeBanner`).
  - Backend runs as a container image on **AWS Lambda** (`deploy/aws-lambda/Dockerfile` + AWS Lambda Web Adapter + Function URL) — **$0 compute when idle**, 2 GB RAM, persistent storage & OAuth via Appwrite Cloud, and Turnstile CAPTCHA.
  - Full step-by-step setup guide: **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.
- **Single-Container Self-Hosting (Docker / EC2 / Coolify / VPS)**:
  ```bash
  docker compose up --build
  ```
  Visit **http://localhost:8000**. For production, set `EDITPDF_ENV=production`, a strong `EDITPDF_AUTH_SECRET` (>= 24 chars), `EDITPDF_ENABLE_DEV_AUTH=false`, and `EDITPDF_ALLOWED_ORIGINS=https://your-domain.com`.

### CI/CD Workflows
- `.github/workflows/ci.yml`: Runs backend `ruff`, `pyright`, `pytest` and frontend `typecheck`, `build`, and production bundle hygiene checks on every push & PR.
- `.github/workflows/deploy-frontend.yml`: Builds and deploys `frontend/dist` to Cloudflare Pages on pushes to `frontend/**`.
- `.github/workflows/deploy-backend.yml`: Builds `deploy/aws-lambda/Dockerfile`, pushes to Amazon ECR, and updates the AWS Lambda container on pushes to `backend/**`.

---

## Optional: Appwrite Cloud Setup (OAuth + Cloud Storage)

To enable Google/GitHub OAuth and persistent cloud storage with [Appwrite](https://appwrite.io/):

1. Copy the environment templates:
   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```
2. Fill in `APPWRITE_ENDPOINT`, `APPWRITE_PROJECT_ID`, and `APPWRITE_API_KEY` in `backend/.env`.
3. Add your frontend hostname under **Appwrite Console → Overview → Platforms → Web** and enable Google/GitHub OAuth providers.
4. Bootstrap the TablesDB tables, indexes, and Storage bucket automatically:
   ```bash
   cd backend && uv run python scripts/setup_appwrite.py
   ```

---

## Environment Variables

| Variable | Default | Description |
| :--- | :--- | :--- |
| `EDITPDF_ENV` | `development` | Set to `production` to enforce startup security guards & HSTS |
| `EDITPDF_AUTH_SECRET` | dev default | **Required in prod (>=24 chars)**. Signs cookies & short-lived asset URLs |
| `EDITPDF_ENABLE_DEV_AUTH` | auto | Local dev test login; **must be `false` in production** |
| `EDITPDF_ALLOWED_ORIGINS` | localhost | Comma-separated allowed CORS origins |
| `EDITPDF_TRUST_PROXY_HEADERS` | `false` | Set `true` behind Cloudflare / proxy for real client IPs |
| `EDITPDF_COOKIE_SECURE` | auto | Set `true` in production HTTPS deployments |
| `EDITPDF_COOKIE_SAMESITE` | `lax` | Set `none` (with `COOKIE_SECURE=true`) for cross-origin split deploys |
| `EDITPDF_SESSIONS_DIR` | `backend/tmp/sessions` | Writable sessions/cache directory (set `/tmp/verso-sessions` on serverless) |
| `EDITPDF_MAX_PDF_BYTES` | `25000000` | Max uploaded PDF size in bytes (use `5000000` on AWS Lambda Function URLs) |
| `EDITPDF_MAX_PDF_PAGES` | `50` | Max pages per uploaded PDF |
| `EDITPDF_MAX_IMAGE_BYTES` | `5000000` | Max image/stamp/signature size in bytes (5 MB) |
| `EDITPDF_STORAGE_QUOTA_BYTES` | `2000000000` | Per-user storage quota (2 GB) |
| `EDITPDF_RATE_LIMIT_ENABLED` | `true` | Toggle sliding-window API rate limiting |
| `TURNSTILE_SITE_KEY` / `SECRET_KEY` | *(empty)* | Optional Cloudflare Turnstile CAPTCHA keys |
| `APPWRITE_ENDPOINT` / `PROJECT_ID` / `API_KEY` | *(empty)* | Appwrite Cloud persistence & Google/GitHub OAuth |
| `VITE_API_BASE_URL` | *(empty)* | Frontend API base URL for split deploys (e.g. Lambda Function URL) |

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

- **Deployment Guide**: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- **Architecture Deep Dive**: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **Contributing Guide**: [CONTRIBUTING.md](CONTRIBUTING.md)
- **AI Agent Guidance & Skills**: [AGENTS.md](AGENTS.md) and `.agents/skills/`
- **Security Policy**: [SECURITY.md](SECURITY.md)

## License

MIT — see [LICENSE](LICENSE).
