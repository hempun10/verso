# Free Production Deployment Guide (Cloudflare Pages + Hugging Face Spaces + Appwrite)

This setup runs **verso** at **$0/month with no metered billing surprises**:

- **Frontend**: **Cloudflare Pages** (unlimited free static bandwidth)
- **Backend API**: **Hugging Face Spaces (Docker SDK — CPU Basic, 16 GB RAM)** — handles PyMuPDF, OpenCV, and RapidOCR smoothly without OOM errors
- **Auth, Database & File Storage**: **Appwrite Cloud (Free tier)** — keeps the Docker backend stateless so container restarts never lose documents

---

## 1. Set Up Appwrite Cloud (Auth + Persistence)

1. Create a free project in [Appwrite Cloud](https://cloud.appwrite.io/).
2. Create an API key with scopes for `databases.*`, `tables.*`, `storage.*`, and `users.read`.
3. Under **Auth → Settings**, enable Google / GitHub OAuth providers (optional) and add your Cloudflare Pages domain as a **Web Platform** (`https://your-app.pages.dev`).
4. Run the bootstrap script once locally to create the `documents`, `folders`, and `assets` tables + storage bucket:
   ```bash
   cd backend
   APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1 \
   APPWRITE_PROJECT_ID=your-project-id \
   APPWRITE_API_KEY=your-api-key \
   uv run python scripts/setup_appwrite.py
   ```

---

## 2. Deploy Backend to Hugging Face Spaces (Docker SDK)

1. Create a new Space on [Hugging Face Spaces](https://huggingface.co/spaces):
   - **SDK**: `Docker` (Blank template)
   - **Hardware**: `CPU basic · 2 vCPU · 16 GB` (Free)
2. Copy the repo contents into the Space repository:
   - Copy `deploy/huggingface/Dockerfile` to the Space root as `Dockerfile`
   - Copy `deploy/huggingface/README.space.md` to the Space root as `README.md`
   - Include the `backend/` folder (`pyproject.toml`, `uv.lock`, `src/`, `scripts/`)
3. In your Space **Settings → Variables and secrets**, configure:

   **Secrets** (never commit these):
   - `EDITPDF_AUTH_SECRET`: random 64-char hex string (`openssl rand -hex 32`)
   - `APPWRITE_API_KEY`: your Appwrite server API key
   - `TURNSTILE_SECRET_KEY`: *(optional)* Cloudflare Turnstile secret key

   **Variables**:
   - `EDITPDF_ENV=production`
   - `EDITPDF_ENABLE_DEV_AUTH=false`
   - `EDITPDF_ALLOWED_ORIGINS=https://your-app.pages.dev` *(comma-separated if you also have a custom domain)*
   - `EDITPDF_TRUST_PROXY_HEADERS=true`
   - `EDITPDF_COOKIE_SECURE=true`
   - `EDITPDF_COOKIE_SAMESITE=none` *(required for cross-origin guest cookies between Pages and HF Space)*
   - `APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1`
   - `APPWRITE_PROJECT_ID=your-project-id`
   - `TURNSTILE_SITE_KEY`: *(optional)* Cloudflare Turnstile site key

4. Once built, note your direct Space API URL:
   `https://<your-username>-<your-space-name>.hf.space`
   Verify it returns `{"status":"ok",...}` at `/api/health`.

---

## 3. Deploy Frontend to Cloudflare Pages

1. Connect your GitHub repo in **Cloudflare Dashboard → Workers & Pages → Create → Pages**.
2. Configure the build settings:
   - **Root directory**: `frontend`
   - **Build command**: `pnpm run build`
   - **Build output directory**: `dist`
3. Add the **Environment Variable** (Production & Preview):
   - `VITE_API_BASE_URL=https://<your-username>-<your-space-name>.hf.space`
4. Deploy! `frontend/public/_redirects` is automatically copied into `dist/` so SPA deep-links (`/?doc=...`) work seamlessly.

---

## Cold-Start Behavior

Hugging Face Spaces free tier sleeps after **48 hours of zero traffic**. When a user opens your Cloudflare Pages site:

1. The frontend immediately calls `/api/health` and `/api/auth/config` in the background, waking the Space while the user views the landing page.
2. `apiFetch` automatically retries transient `502`/`503`/`504` wake responses with exponential backoff and displays a subtle **"Starting document server…"** pill (`ServerWakeBanner`) until the container is ready.
