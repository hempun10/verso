"""Auth verification for Appwrite JWTs, dev tokens, signed guest cookies, and asset URLs."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time

import httpx

from editpdf.config import Settings
from editpdf.models import UserInfo

GUEST_USER = UserInfo(id="guest", email="guest@local", name="Guest", provider="guest")
GUEST_COOKIE_NAME = "verso_guest"
GUEST_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60
JWT_CACHE_TTL_SECONDS = 60.0
ASSET_URL_TTL_SECONDS = 2 * 60 * 60


class AuthService:
    """Resolves Appwrite JWTs, dev tokens, per-browser guest sessions, and signed asset URLs."""

    def __init__(self, settings: Settings):
        self.settings = settings
        self._jwt_cache: dict[str, tuple[float, UserInfo]] = {}

    def _sign(self, data: str) -> str:
        return hmac.new(
            self.settings.auth_secret.encode("utf-8"),
            data.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

    # --- Per-browser isolated guest cookies ---

    def issue_guest_session(self) -> tuple[str, UserInfo]:
        guest_id = f"gst_{secrets.token_hex(8)}"
        sig = self._sign(f"guest:{guest_id}")
        token = f"{guest_id}.{sig}"
        user = UserInfo(id=guest_id, email="", name="Guest", provider="guest")
        return token, user

    def verify_guest_token(self, token: str | None) -> UserInfo | None:
        if not token or "." not in token:
            return None
        guest_id, sig = token.split(".", 1)
        if not guest_id.startswith("gst_") or len(guest_id) > 40:
            return None
        if not all(ch.isalnum() or ch == "_" for ch in guest_id):
            return None
        expected = self._sign(f"guest:{guest_id}")
        if not hmac.compare_digest(sig, expected):
            return None
        return UserInfo(id=guest_id, email="", name="Guest", provider="guest")

    # --- Signed short-lived asset URLs ---

    def sign_asset_url(self, asset_id: str, ttl_seconds: int = ASSET_URL_TTL_SECONDS) -> str:
        exp = int(time.time()) + ttl_seconds
        sig = self._sign(f"asset:{asset_id}:{exp}")[:32]
        return f"/api/assets/{asset_id}/content?exp={exp}&sig={sig}"

    def verify_asset_signature(self, asset_id: str, exp: int | None, sig: str | None) -> bool:
        if not exp or not sig:
            return False
        if exp < int(time.time()):
            return False
        expected = self._sign(f"asset:{asset_id}:{exp}")[:32]
        return hmac.compare_digest(sig, expected)

    # --- Local dev HMAC tokens ---

    def issue_dev_token(self, email: str, name: str) -> tuple[str, UserInfo]:
        clean_email = email.strip().lower()
        clean_name = name.strip() or clean_email.split("@")[0].title()
        user_id = "dev_" + hashlib.sha256(clean_email.encode("utf-8")).hexdigest()[:16]
        user = UserInfo(id=user_id, email=clean_email, name=clean_name, provider="dev")
        payload_bytes = json.dumps(
            {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "iat": int(time.time()),
            },
            separators=(",", ":"),
        ).encode("utf-8")
        encoded = base64.urlsafe_b64encode(payload_bytes).decode("ascii").rstrip("=")
        sig = self._sign(encoded)
        return f"dev.{encoded}.{sig}", user

    def _verify_dev_token(self, token: str) -> UserInfo | None:
        parts = token.split(".")
        if len(parts) != 3 or parts[0] != "dev":
            return None
        encoded, sig = parts[1], parts[2]
        expected = self._sign(encoded)
        if not hmac.compare_digest(sig, expected):
            return None
        padded = encoded + "=" * (-len(encoded) % 4)
        try:
            data = json.loads(base64.urlsafe_b64decode(padded))
            return UserInfo(
                id=str(data["id"]),
                email=str(data["email"]),
                name=str(data["name"]),
                provider="dev",
            )
        except Exception:
            return None

    # --- Appwrite OAuth JWT verification ---

    def _verify_appwrite_jwt(self, jwt_token: str) -> UserInfo | None:
        if not self.settings.use_appwrite_auth:
            return None

        now = time.time()
        # Keep JWT cache bounded.
        if len(self._jwt_cache) > 1024:
            expired = [
                k
                for k, (ts, _) in self._jwt_cache.items()
                if now - ts >= JWT_CACHE_TTL_SECONDS
            ]
            for k in expired:
                self._jwt_cache.pop(k, None)

        cached = self._jwt_cache.get(jwt_token)
        if cached and now - cached[0] < JWT_CACHE_TTL_SECONDS:
            return cached[1]

        url = f"{self.settings.appwrite_endpoint}/account"
        headers = {
            "X-Appwrite-Project": self.settings.appwrite_project_id,
            "X-Appwrite-JWT": jwt_token,
        }
        try:
            with httpx.Client(timeout=6.0) as client:
                res = client.get(url, headers=headers)
            if res.status_code != 200:
                return None
            body = res.json()
            user = UserInfo(
                id=str(body["$id"]),
                email=str(body.get("email") or ""),
                name=str(body.get("name") or body.get("email") or "User"),
                provider="appwrite",
            )
            self._jwt_cache[jwt_token] = (now, user)
            return user
        except Exception:
            return None

    def resolve_user(
        self,
        auth_header: str | None,
        guest_cookie: str | None = None,
    ) -> tuple[UserInfo, str | None]:
        """Resolve an authenticated user or per-browser isolated guest.

        Returns `(user, new_guest_cookie_value)`. When `new_guest_cookie_value` is not None,
        the caller should set it as an HttpOnly cookie on the HTTP response.
        """
        token = ""
        if auth_header:
            raw = auth_header.strip()
            if raw.lower().startswith("bearer "):
                token = raw[7:].strip()
            else:
                token = raw

        if not token:
            existing_guest = self.verify_guest_token(guest_cookie)
            if existing_guest is not None:
                return existing_guest, None
            new_cookie, new_guest = self.issue_guest_session()
            return new_guest, new_cookie

        if token.startswith("dev."):
            if not self.settings.dev_login_enabled:
                raise PermissionError("Local dev sign-in is disabled.")
            user = self._verify_dev_token(token)
            if user is None:
                raise PermissionError("Invalid or expired session token.")
            return user, None

        user = self._verify_appwrite_jwt(token)
        if user is None:
            raise PermissionError("Invalid or expired Appwrite session token.")
        return user, None
