"""Runtime configuration for EditPDF (Appwrite, CORS, upload limits, rate limiting, and CAPTCHA)."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

ENV_PATH = Path(__file__).resolve().parents[2] / ".env"

# Appwrite Cloud Storage bucket hard ceiling is 50,000,000 bytes; keep defaults safely below it.
APPWRITE_MAX_BUCKET_BYTES = 50_000_000
APPWRITE_MAX_COLUMN_CHARS = 950_000
DEFAULT_DEV_AUTH_SECRET = "editpdf-local-dev-secret-change-me"
DEFAULT_ALLOWED_ORIGINS = (
    "http://localhost:3003",
    "http://127.0.0.1:3003",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
)


def _load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def _env_int(name: str, default: int, *, minimum: int = 1, maximum: int | None = None) -> int:
    raw = os.getenv(name, "").strip()
    if not raw:
        val = default
    else:
        try:
            val = int(raw)
        except ValueError:
            val = default
    val = max(minimum, val)
    if maximum is not None:
        val = min(maximum, val)
    return val


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name, "").strip().lower()
    if not raw:
        return default
    return raw in {"1", "true", "yes", "on"}


def _env_origins(name: str, default: tuple[str, ...]) -> tuple[str, ...]:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    origins = tuple(item.strip().rstrip("/") for item in raw.split(",") if item.strip())
    return origins or default


def _env_samesite(
    name: str, default: Literal["lax", "strict", "none"]
) -> Literal["lax", "strict", "none"]:
    raw = os.getenv(name, "").strip().lower()
    if raw == "lax":
        return "lax"
    if raw == "strict":
        return "strict"
    if raw == "none":
        return "none"
    return default


@dataclass(frozen=True)
class Settings:
    appwrite_endpoint: str
    appwrite_project_id: str
    appwrite_api_key: str
    appwrite_database_id: str
    appwrite_documents_collection_id: str
    appwrite_assets_collection_id: str
    appwrite_folders_collection_id: str
    appwrite_bucket_id: str
    auth_secret: str
    dev_login_enabled: bool
    # Environment, CORS, proxy & cookie security
    environment: str = "development"
    allowed_origins: tuple[str, ...] = DEFAULT_ALLOWED_ORIGINS
    trust_proxy_headers: bool = False
    cookie_secure: bool = False
    cookie_samesite: Literal["lax", "strict", "none"] = "lax"
    # Upload & Appwrite-aligned validation limits
    max_pdf_bytes: int = 25_000_000
    max_pdf_pages: int = 50
    max_image_bytes: int = 5_000_000
    max_state_chars: int = APPWRITE_MAX_COLUMN_CHARS
    storage_quota_bytes: int = 2_000_000_000
    # Bounded local cache & CPU concurrency controls
    max_cached_docs: int = 64
    max_disk_cache_bytes: int = 500_000_000
    ocr_concurrency: int = 3
    # Rate limiting & Cloudflare Turnstile CAPTCHA
    rate_limit_enabled: bool = True
    turnstile_site_key: str = ""
    turnstile_secret_key: str = ""

    @property
    def is_production(self) -> bool:
        return self.environment.lower() in {"prod", "production"}

    @property
    def use_appwrite_storage(self) -> bool:
        return bool(
            self.appwrite_endpoint and self.appwrite_project_id and self.appwrite_api_key
        )

    @property
    def use_appwrite_auth(self) -> bool:
        return bool(self.appwrite_endpoint and self.appwrite_project_id)

    @property
    def captcha_enabled(self) -> bool:
        return bool(self.turnstile_site_key and self.turnstile_secret_key)

    def validate_for_startup(self) -> None:
        """Fail fast if unsafe dev defaults are left enabled in production."""
        if not self.is_production:
            return
        if self.dev_login_enabled:
            raise RuntimeError(
                "EDITPDF_ENABLE_DEV_AUTH must be false when EDITPDF_ENV=production."
            )
        if self.auth_secret == DEFAULT_DEV_AUTH_SECRET or len(self.auth_secret) < 24:
            raise RuntimeError(
                "EDITPDF_AUTH_SECRET must be set to a strong secret (>= 24 chars) in production."
            )
        if "*" in self.allowed_origins:
            raise RuntimeError(
                "EDITPDF_ALLOWED_ORIGINS cannot contain '*' when credentials are enabled."
            )
        if self.cookie_samesite == "none" and not self.cookie_secure:
            raise RuntimeError(
                "EDITPDF_COOKIE_SECURE must be true when EDITPDF_COOKIE_SAMESITE=none."
            )


def load_settings() -> Settings:
    _load_dotenv(ENV_PATH)
    environment = os.getenv("EDITPDF_ENV", "development").strip().lower() or "development"
    is_prod = environment in {"prod", "production"}
    endpoint = os.getenv("APPWRITE_ENDPOINT", "").rstrip("/")
    project_id = os.getenv("APPWRITE_PROJECT_ID", "").strip()
    api_key = os.getenv("APPWRITE_API_KEY", "").strip()

    dev_flag = os.getenv("EDITPDF_ENABLE_DEV_AUTH", "").strip().lower()
    if dev_flag:
        dev_enabled = dev_flag in {"1", "true", "yes", "on"}
    else:
        dev_enabled = (not is_prod) and (not (endpoint and project_id))

    rate_limit_enabled = _env_bool("EDITPDF_RATE_LIMIT_ENABLED", True)
    trust_proxy_headers = _env_bool("EDITPDF_TRUST_PROXY_HEADERS", is_prod)
    cookie_secure = _env_bool("EDITPDF_COOKIE_SECURE", is_prod)
    cookie_samesite = _env_samesite("EDITPDF_COOKIE_SAMESITE", "lax")

    return Settings(
        appwrite_endpoint=endpoint,
        appwrite_project_id=project_id,
        appwrite_api_key=api_key,
        appwrite_database_id=os.getenv("APPWRITE_DATABASE_ID", "editpdf").strip(),
        appwrite_documents_collection_id=os.getenv(
            "APPWRITE_DOCUMENTS_COLLECTION_ID", "documents"
        ).strip(),
        appwrite_assets_collection_id=os.getenv(
            "APPWRITE_ASSETS_COLLECTION_ID", "assets"
        ).strip(),
        appwrite_folders_collection_id=os.getenv(
            "APPWRITE_FOLDERS_COLLECTION_ID", "folders"
        ).strip(),
        appwrite_bucket_id=os.getenv("APPWRITE_BUCKET_ID", "editpdf_files").strip(),
        auth_secret=os.getenv("EDITPDF_AUTH_SECRET", DEFAULT_DEV_AUTH_SECRET),
        dev_login_enabled=dev_enabled,
        environment=environment,
        allowed_origins=_env_origins("EDITPDF_ALLOWED_ORIGINS", DEFAULT_ALLOWED_ORIGINS),
        trust_proxy_headers=trust_proxy_headers,
        cookie_secure=cookie_secure,
        cookie_samesite=cookie_samesite,
        max_pdf_bytes=_env_int(
            "EDITPDF_MAX_PDF_BYTES",
            25_000_000,
            minimum=100_000,
            maximum=APPWRITE_MAX_BUCKET_BYTES,
        ),
        max_pdf_pages=_env_int("EDITPDF_MAX_PDF_PAGES", 50, minimum=1, maximum=500),
        max_image_bytes=_env_int(
            "EDITPDF_MAX_IMAGE_BYTES",
            5_000_000,
            minimum=50_000,
            maximum=APPWRITE_MAX_BUCKET_BYTES,
        ),
        max_state_chars=APPWRITE_MAX_COLUMN_CHARS,
        storage_quota_bytes=_env_int(
            "EDITPDF_STORAGE_QUOTA_BYTES",
            2_000_000_000,
            minimum=1_000_000,
        ),
        max_cached_docs=_env_int("EDITPDF_MAX_CACHED_DOCS", 64, minimum=4, maximum=512),
        max_disk_cache_bytes=_env_int(
            "EDITPDF_MAX_DISK_CACHE_BYTES",
            500_000_000,
            minimum=25_000_000,
        ),
        ocr_concurrency=_env_int("EDITPDF_OCR_CONCURRENCY", 3, minimum=1, maximum=16),
        rate_limit_enabled=rate_limit_enabled,
        turnstile_site_key=os.getenv("TURNSTILE_SITE_KEY", "").strip(),
        turnstile_secret_key=os.getenv("TURNSTILE_SECRET_KEY", "").strip(),
    )
