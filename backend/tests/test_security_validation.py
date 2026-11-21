"""Tests for Appwrite-aligned upload validation, rate limiting, and CAPTCHA enforcement."""

from __future__ import annotations

import base64
import io
from dataclasses import replace
from pathlib import Path

import pymupdf
from fastapi.testclient import TestClient
from PIL import Image

from editpdf.api import create_app
from editpdf.config import load_settings
from editpdf.security import SlidingWindowRateLimiter, TurnstileVerifier
from editpdf.service import SessionStore


def _make_pdf(pages: int = 1) -> bytes:
    doc = pymupdf.open()
    for i in range(pages):
        p = doc.new_page(width=612, height=792)
        p.insert_text((72, 100), f"Page {i + 1}", fontsize=16)
    out = doc.tobytes()
    doc.close()
    return out


def test_pdf_and_image_size_and_page_validation(tmp_path: Path):
    base_settings = load_settings()
    strict_settings = replace(
        base_settings,
        max_pdf_bytes=120_000,
        max_pdf_pages=2,
        max_image_bytes=4_000,
        rate_limit_enabled=False,
    )
    store = SessionStore(root_dir=tmp_path, settings=strict_settings)
    client = TestClient(create_app(store=store))

    # Auth config exposes exact upload limits to client for pre-upload validation.
    cfg = client.get("/api/auth/config").json()
    assert cfg["limits"]["max_pdf_bytes"] == 120_000
    assert cfg["limits"]["max_pdf_pages"] == 2
    assert cfg["limits"]["max_image_bytes"] == 4_000

    # Oversized PDF -> 413 Payload Too Large.
    big_pdf = b"%PDF-1.4\n" + (b"0" * 130_000)
    res_big = client.post(
        "/api/documents",
        files={"file": ("huge.pdf", big_pdf, "application/pdf")},
    )
    assert res_big.status_code == 413

    # Too many pages -> 400 Bad Request.
    res_pages = client.post(
        "/api/documents",
        files={"file": ("three.pdf", _make_pdf(pages=3), "application/pdf")},
    )
    assert res_pages.status_code == 400
    assert "maximum allowed is 2 pages" in res_pages.json()["detail"]

    # Unsupported image MIME -> 400.
    res_mime = client.post(
        "/api/assets",
        json={
            "kind": "image",
            "name": "bad",
            "data_url": "data:image/gif;base64,R0lGODlhAQABAAAAACw=",
        },
    )
    assert res_mime.status_code == 400

    # Oversized image -> 413.
    noisy = Image.effect_noise((200, 200), 100).convert("RGB")
    buf = io.BytesIO()
    noisy.save(buf, format="PNG")
    big_img = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")
    res_big_img = client.post(
        "/api/assets",
        json={"kind": "image", "name": "huge", "data_url": big_img},
    )
    assert res_big_img.status_code == 413


def test_sliding_window_rate_limiting_returns_429_and_retry_after(tmp_path: Path):
    now = [1000.0]
    limiter = SlidingWindowRateLimiter(enabled=True, clock=lambda: now[0])
    store = SessionStore(root_dir=tmp_path)
    client = TestClient(create_app(store=store, rate_limiter=limiter))

    # Auth bucket allows 12 requests per 60s window.
    for _ in range(12):
        res = client.post("/api/auth/dev-login", json={"email": "a@b.com", "name": "A"})
        assert res.status_code == 200
        assert res.headers["X-RateLimit-Limit"] == "12"

    blocked = client.post("/api/auth/dev-login", json={"email": "a@b.com", "name": "A"})
    assert blocked.status_code == 429
    assert int(blocked.headers["Retry-After"]) >= 1

    # Advancing clock past 60s restores quota cleanly.
    now[0] += 61.0
    recovered = client.post("/api/auth/dev-login", json={"email": "a@b.com", "name": "A"})
    assert recovered.status_code == 200


def test_turnstile_captcha_enforcement_on_uploads_and_login(tmp_path: Path):
    verifier = TurnstileVerifier(
        site_key="test-site-key",
        secret_key="test-secret-key",
        verify_fn=lambda tok, _ip: tok == "valid-token",
    )
    store = SessionStore(root_dir=tmp_path)
    client = TestClient(
        create_app(
            store=store,
            rate_limiter=SlidingWindowRateLimiter(enabled=False),
            captcha_verifier=verifier,
        )
    )

    cfg = client.get("/api/auth/config").json()
    assert cfg["captcha_enabled"] is True
    assert cfg["turnstile_site_key"] == "test-site-key"

    # Missing token -> 403
    assert (
        client.post(
            "/api/documents",
            files={"file": ("ok.pdf", _make_pdf(1), "application/pdf")},
        ).status_code
        == 403
    )

    # Invalid token -> 403
    assert (
        client.post(
            "/api/auth/dev-login",
            headers={"X-Captcha-Token": "wrong-token"},
            json={"email": "a@b.com", "name": "A"},
        ).status_code
        == 403
    )

    # Valid token -> 200
    ok_up = client.post(
        "/api/documents",
        headers={"X-Captcha-Token": "valid-token"},
        files={"file": ("ok.pdf", _make_pdf(1), "application/pdf")},
    )
    assert ok_up.status_code == 200
