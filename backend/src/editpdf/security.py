"""Rate limiting, Cloudflare Turnstile CAPTCHA verification, and upload validation."""

from __future__ import annotations

import math
import threading
import time
from collections import deque
from collections.abc import Callable
from dataclasses import dataclass
from typing import Literal

import httpx

ALLOWED_IMAGE_MIME_TYPES = ("image/png", "image/jpeg", "image/webp")
TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


@dataclass(frozen=True)
class RateLimitResult:
    allowed: bool
    limit: int
    remaining: int
    retry_after_seconds: int


class SlidingWindowRateLimiter:
    """Thread-safe in-memory sliding-window rate limiter keyed by bucket + client/user."""

    def __init__(self, enabled: bool = True, clock: Callable[[], float] | None = None):
        self.enabled = enabled
        self._clock = clock or time.monotonic
        self._lock = threading.Lock()
        self._hits: dict[str, tuple[float, deque[float]]] = {}
        self._checks_since_prune = 0

    def _prune_stale_locked(self, now: float) -> None:
        stale_keys = [
            key
            for key, (win, dq) in self._hits.items()
            if not dq or (now - dq[-1]) >= win
        ]
        for key in stale_keys:
            self._hits.pop(key, None)

    def check(
        self,
        bucket: str,
        subject: str,
        *,
        limit: int,
        window_seconds: float = 60.0,
    ) -> RateLimitResult:
        if not self.enabled:
            return RateLimitResult(True, limit, limit, 0)

        now = self._clock()
        cutoff = now - window_seconds
        key = f"{bucket}:{subject}"

        with self._lock:
            self._checks_since_prune += 1
            if self._checks_since_prune >= 256 or len(self._hits) > 4096:
                self._prune_stale_locked(now)
                self._checks_since_prune = 0

            entry = self._hits.get(key)
            if entry is None:
                dq: deque[float] = deque()
                self._hits[key] = (window_seconds, dq)
            else:
                dq = entry[1]
                if entry[0] != window_seconds:
                    self._hits[key] = (window_seconds, dq)

            while dq and dq[0] <= cutoff:
                dq.popleft()

            if len(dq) >= limit:
                retry_after = max(1, int(math.ceil(window_seconds - (now - dq[0]))))
                return RateLimitResult(False, limit, 0, retry_after)

            dq.append(now)
            remaining = max(0, limit - len(dq))
            return RateLimitResult(True, limit, remaining, 0)


class TurnstileVerifier:
    """Verifies Cloudflare Turnstile CAPTCHA tokens when configured."""

    def __init__(
        self,
        site_key: str = "",
        secret_key: str = "",
        verify_fn: Callable[[str, str | None], bool] | None = None,
    ):
        self.site_key = site_key
        self.secret_key = secret_key
        self._verify_fn = verify_fn

    @property
    def enabled(self) -> bool:
        return bool(self.site_key and self.secret_key)

    def verify(self, token: str | None, remote_ip: str | None = None) -> bool:
        if not self.enabled:
            return True
        clean = (token or "").strip()
        if not clean:
            return False
        if self._verify_fn is not None:
            return self._verify_fn(clean, remote_ip)

        payload: dict[str, str] = {
            "secret": self.secret_key,
            "response": clean,
        }
        if remote_ip:
            payload["remoteip"] = remote_ip
        try:
            with httpx.Client(timeout=6.0) as client:
                res = client.post(TURNSTILE_VERIFY_URL, data=payload)
            if res.status_code != 200:
                return False
            return bool(res.json().get("success", False))
        except Exception:
            return False


def format_mb(num_bytes: int) -> str:
    mb = num_bytes / 1_000_000
    return f"{mb:.0f} MB" if mb >= 10 or mb.is_integer() else f"{mb:.1f} MB"


def detect_image_mime(raw: bytes) -> str | None:
    if raw.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if raw.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if len(raw) >= 12 and raw[:4] == b"RIFF" and raw[8:12] == b"WEBP":
        return "image/webp"
    return None


def validate_pdf_bytes(raw: bytes, max_bytes: int) -> None:
    if len(raw) == 0:
        raise ValueError("Empty file.")
    if len(raw) > max_bytes:
        raise OverflowError(
            f"PDF is {format_mb(len(raw))} — maximum allowed size is {format_mb(max_bytes)}."
        )
    if not raw.startswith(b"%PDF"):
        raise ValueError("Uploaded file is not a valid PDF document.")


def validate_document_upload(
    raw: bytes,
    *,
    max_pdf_bytes: int,
    max_image_bytes: int,
) -> Literal["pdf", "image"]:
    if len(raw) == 0:
        raise ValueError("Empty file.")
    if raw.startswith(b"%PDF"):
        if len(raw) > max_pdf_bytes:
            raise OverflowError(
                f"PDF is {format_mb(len(raw))} — maximum allowed size is "
                f"{format_mb(max_pdf_bytes)}."
            )
        return "pdf"
    img_mime = detect_image_mime(raw)
    if img_mime is not None:
        if len(raw) > max_image_bytes:
            raise OverflowError(
                f"Image is {format_mb(len(raw))} — maximum allowed size is "
                f"{format_mb(max_image_bytes)}."
            )
        return "image"
    raise ValueError("Uploaded file must be a valid PDF or image (PNG, JPG, WebP).")


def validate_image_upload(img_bytes: bytes, mime_type: str, max_bytes: int) -> None:
    if len(img_bytes) == 0:
        raise ValueError("Empty image.")
    if len(img_bytes) > max_bytes:
        raise OverflowError(
            f"Image is {format_mb(len(img_bytes))} — maximum allowed size is "
            f"{format_mb(max_bytes)}."
        )
    if mime_type not in ALLOWED_IMAGE_MIME_TYPES:
        raise ValueError("Unsupported image format. Allowed types: PNG, JPEG, WebP.")
