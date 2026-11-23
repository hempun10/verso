# Production & Self-Hosting Deployment Guide

**verso** runs on a serverless stack (**Cloudflare Pages** + **AWS Lambda Container** + **Appwrite Cloud**) with **$0 compute cost when idle**, or as a **single Docker container** on any VPS / EC2 / Coolify server.

---

## Option A: Serverless Stack (Cloudflare Pages + AWS Lambda + Appwrite)

### 1. Appwrite Cloud (Auth + Persistent Storage)
1. Create a free project in [Appwrite Cloud](https://cloud.appwrite.io/).
2. Add your frontend domain under **Overview → Platforms → Web** (e.g. `your-app.pages.dev`).
3. Enable **Google** / **GitHub** OAuth under **Auth → Settings**.
4. Create a server API key (`databases.*`, `tables.*`, `storage.*`, `users.read`) and run the schema bootstrap once:
   ```bash
   cd backend
   APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1 \
   APPWRITE_PROJECT_ID=your-project-id \
   APPWRITE_API_KEY=your-api-key \
   uv run python scripts/setup_appwrite.py
   ```

### 2. One-Time AWS Lambda + ECR Setup
Provision the ECR repo, IAM execution role, Lambda function (`2048 MB` RAM, `120s` timeout, `1024 MB` `/tmp`), and public HTTPS Function URL once using the AWS Console or AWS CLI:

1. Create an ECR repository (`verso-api`) and add a lifecycle policy to keep the last 2 images.
2. Build & push the initial image from `deploy/aws-lambda/Dockerfile` (`--platform linux/amd64 --provenance=false`).
3. Create the Lambda container function (`verso-api`) using that image and set its **Environment Variables** directly in AWS Lambda Configuration:
   - `EDITPDF_ENV=production`
   - `EDITPDF_ENABLE_DEV_AUTH=false`
   - `EDITPDF_AUTH_SECRET=<openssl rand -hex 32>`
   - `EDITPDF_ALLOWED_ORIGINS=https://your-app.pages.dev`
   - `EDITPDF_TRUST_PROXY_HEADERS=true`
   - `EDITPDF_COOKIE_SECURE=true`
   - `EDITPDF_COOKIE_SAMESITE=none`
   - `EDITPDF_SESSIONS_DIR=/tmp/verso-sessions`
   - `EDITPDF_MAX_PDF_BYTES=5000000` *(stays within Lambda Function URL's 6 MB payload ceiling)*
   - `APPWRITE_ENDPOINT`, `APPWRITE_PROJECT_ID`, `APPWRITE_API_KEY`
   - *(Optional)* `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` (Cloudflare Turnstile CAPTCHA)
4. Enable **Function URL** (`AuthType: NONE`, `InvokeMode: BUFFERED`) with both `lambda:InvokeFunctionUrl` and `lambda:InvokeFunction` (`--invoked-via-function-url`) permissions. Do **not** enable Lambda's built-in CORS toggle — FastAPI's `CORSMiddleware` handles CORS + credentials directly.

### 3. Cloudflare Pages (Frontend)
Create a Pages project once with Wrangler (or Cloudflare Dashboard):
```bash
pnpm dlx wrangler pages project create your-app --production-branch main --force
```

### 4. GitHub Actions CI/CD (Minimal Secrets)
Once infrastructure is provisioned, `.github/workflows/deploy-frontend.yml` and `.github/workflows/deploy-backend.yml` only build and push code — runtime secrets stay in AWS Lambda.

| Scope | Name | Purpose |
| --- | --- | --- |
| Secret | `CLOUDFLARE_API_TOKEN` | Cloudflare Pages Edit token |
| Secret | `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID |
| Variable | `VITE_API_BASE_URL` | Live backend URL (`https://<id>.lambda-url.<region>.on.aws`) |
| Variable | `CF_PAGES_PROJECT` | *(Optional)* Cloudflare Pages project name |
| Secret | `AWS_ACCESS_KEY_ID` | IAM user with ECR push + `lambda:UpdateFunctionCode` |
| Secret | `AWS_SECRET_ACCESS_KEY` | IAM user secret key |
| Variable | `AWS_REGION` | *(Optional)* AWS region (default `ap-south-1`) |
| Variable | `AWS_ECR_REPO` | *(Optional)* ECR repository name (default `verso-api`) |
| Variable | `AWS_LAMBDA_FUNCTION` | *(Optional)* Lambda function name (default `verso-api`) |

---

## Option B: Single-Container Self-Hosting (EC2 / Coolify / VPS)

Build and run the root `Dockerfile` (serves both the React SPA and FastAPI API on port `8000` with zero cold starts and up to `25 MB` uploads):

```bash
docker build -t verso .
docker run -p 8000:8000 \
  -e EDITPDF_ENV=production \
  -e EDITPDF_ENABLE_DEV_AUTH=false \
  -e EDITPDF_AUTH_SECRET="$(openssl rand -hex 32)" \
  -e EDITPDF_ALLOWED_ORIGINS="https://your-domain.com" \
  verso
```
