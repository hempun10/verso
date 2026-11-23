# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in `verso`, **please do not open a public GitHub issue**.

Instead, report it privately via GitHub Security Advisories (**Security → Advisories → Report a vulnerability**) or contact the maintainers directly with:
- A clear description of the issue and potential impact
- Steps to reproduce or a minimal proof of concept
- Any suggested remediation if known

We aim to acknowledge reports within 72 hours and coordinate a fix before public disclosure.

## Built-In Security Controls

- **Upload Validation**: Client-side and server-side magic-byte checks (`%PDF-`, PNG, JPEG, WebP), byte-cap streaming reads, and page-count caps.
- **Tenant & Session Isolation**: Dashboard and editor routes require authentication; users are isolated by account ID, and guest cookies (`verso_guest`) use HMAC-signed `HttpOnly` cookies with `SameSite=None; Secure` in cross-origin production deployments.
- **Private Assets**: Saved signatures, stamps, and images require owner credentials or a short-lived HMAC-signed URL (`exp` + `sig`).
- **Abuse Controls**: Sliding-window rate limiting across upload, auth, write, read, and render buckets, storage quota enforcement, and Cloudflare Turnstile CAPTCHA.
- **Production Startup Guards**: When `EDITPDF_ENV=production`, startup fails fast if dev auth is enabled, `EDITPDF_AUTH_SECRET` is weak/default, CORS allows `*`, or `EDITPDF_COOKIE_SAMESITE=none` is set without `EDITPDF_COOKIE_SECURE=true`.
