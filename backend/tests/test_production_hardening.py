"""Production readiness tests: guest isolation, signed asset auth, quota, & prod guards."""

from __future__ import annotations

import base64
import io
from pathlib import Path

import pymupdf
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from editpdf.api import create_app
from editpdf.config import DEFAULT_DEV_AUTH_SECRET, Settings
from editpdf.service import SessionStore


def _make_pdf_bytes(text: str = "Hello Production") -> bytes:
    doc = pymupdf.open()
    page = doc.new_page(width=400, height=300)
    page.insert_text((40, 80), text, fontsize=14)
    raw = doc.tobytes()
    doc.close()
    return raw


def _make_png_data_url() -> str:
    img = Image.new("RGBA", (64, 64), (27, 63, 139, 255))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def _local_settings(**overrides) -> Settings:
    base = dict(
        appwrite_endpoint="",
        appwrite_project_id="",
        appwrite_api_key="",
        appwrite_database_id="editpdf",
        appwrite_documents_collection_id="documents",
        appwrite_assets_collection_id="assets",
        appwrite_folders_collection_id="folders",
        appwrite_bucket_id="editpdf_files",
        auth_secret="test-secret-with-plenty-of-entropy-123456",
        dev_login_enabled=True,
        rate_limit_enabled=False,
    )
    base.update(overrides)
    return Settings(**base)  # type: ignore[arg-type]


def test_guest_sessions_are_isolated_per_browser_cookie(tmp_path: Path) -> None:
    store = SessionStore(root_dir=tmp_path, settings=_local_settings())
    app = create_app(store=store)

    client_a = TestClient(app)
    client_b = TestClient(app)

    # Guest A uploads a PDF and creates a folder.
    up = client_a.post(
        "/api/documents",
        files={"file": ("secret_a.pdf", _make_pdf_bytes("Secret A"), "application/pdf")},
    )
    assert up.status_code == 200
    assert "verso_guest" in client_a.cookies
    doc_id = up.json()["doc_id"]

    fld = client_a.post("/api/folders", json={"name": "Private Folder A"})
    assert fld.status_code == 200

    # Guest A can read their own workspace.
    assert len(client_a.get("/api/documents").json()) == 1
    assert len(client_a.get("/api/folders").json()) == 1
    assert client_a.get(f"/api/documents/{doc_id}").status_code == 200

    # Guest B (different browser) cannot see Guest A's documents, folders, or open Guest A's doc.
    assert client_b.get("/api/documents").json() == []
    assert client_b.get("/api/folders").json() == []
    assert client_b.get(f"/api/documents/{doc_id}").status_code == 403


def test_asset_content_requires_owner_or_valid_signature(tmp_path: Path) -> None:
    store = SessionStore(root_dir=tmp_path, settings=_local_settings())
    app = create_app(store=store)

    owner = TestClient(app)
    stranger = TestClient(app)

    created = owner.post(
        "/api/assets",
        json={"kind": "signature", "name": "My Sig", "data_url": _make_png_data_url()},
    )
    assert created.status_code == 200
    asset = created.json()
    asset_id = asset["asset_id"]
    signed_url = asset["url"]
    assert "sig=" in signed_url and "exp=" in signed_url

    # Stranger calling unsigned raw URL gets 403.
    assert stranger.get(f"/api/assets/{asset_id}/content").status_code == 403
    # Tampered signature gets 403.
    assert (
        stranger.get(f"/api/assets/{asset_id}/content?exp=9999999999&sig=deadbeef").status_code
        == 403
    )
    # Expired signature gets 403.
    assert stranger.get(f"/api/assets/{asset_id}/content?exp=1&sig=deadbeef").status_code == 403

    # Valid signed URL works (e.g. inside <img> tags and shared docs).
    ok_signed = stranger.get(signed_url)
    assert ok_signed.status_code == 200
    assert ok_signed.headers["x-content-type-options"] == "nosniff"
    assert ok_signed.content.startswith(b"\x89PNG\r\n\x1a\n")

    # Owner cookie can also fetch directly.
    assert owner.get(f"/api/assets/{asset_id}/content").status_code == 200

    # Shared document populates signed asset_url on overlays for collaborators.
    up = owner.post(
        "/api/documents",
        files={"file": ("shared.pdf", _make_pdf_bytes(), "application/pdf")},
    )
    doc_id = up.json()["doc_id"]
    owner.put(
        f"/api/documents/{doc_id}/state",
        json={
            "edits": [],
            "overlays": [
                {
                    "id": "ov_1",
                    "kind": "image",
                    "page_index": 0,
                    "bbox": [10, 10, 100, 100],
                    "asset_id": asset_id,
                    "opacity": 1.0,
                    "angle_deg": 0.0,
                }
            ],
        },
    )
    share = owner.post(f"/api/documents/{doc_id}/share", json={"is_shared": True}).json()
    detail = stranger.get(
        f"/api/documents/{doc_id}?share_token={share['share_token']}"
    ).json()
    ov_url = detail["overlays"][0]["asset_url"]
    assert ov_url and "sig=" in ov_url
    assert stranger.get(ov_url).status_code == 200


def test_storage_quota_is_enforced_on_uploads(tmp_path: Path) -> None:
    pdf = _make_pdf_bytes("Quota test")
    # Allow first PDF, reject second PDF.
    tiny_quota = int(len(pdf) * 1.5)
    store = SessionStore(
        root_dir=tmp_path,
        settings=_local_settings(storage_quota_bytes=tiny_quota),
    )
    app = create_app(store=store)
    client = TestClient(app)

    first = client.post(
        "/api/documents",
        files={"file": ("one.pdf", pdf, "application/pdf")},
    )
    assert first.status_code == 200

    second = client.post(
        "/api/documents",
        files={"file": ("two.pdf", pdf, "application/pdf")},
    )
    assert second.status_code == 413
    assert "quota" in second.json()["detail"].lower()


def test_production_startup_guard_and_security_headers(tmp_path: Path) -> None:
    # Prod with dev login enabled fails fast.
    bad_dev = _local_settings(environment="production", dev_login_enabled=True)
    with pytest.raises(RuntimeError, match="EDITPDF_ENABLE_DEV_AUTH"):
        create_app(store=SessionStore(root_dir=tmp_path / "a", settings=bad_dev))

    # Prod with default weak auth_secret fails fast.
    bad_secret = _local_settings(
        environment="production",
        dev_login_enabled=False,
        auth_secret=DEFAULT_DEV_AUTH_SECRET,
    )
    with pytest.raises(RuntimeError, match="EDITPDF_AUTH_SECRET"):
        create_app(store=SessionStore(root_dir=tmp_path / "b", settings=bad_secret))

    # Valid production config boots cleanly and emits HSTS + security headers.
    good_prod = _local_settings(
        environment="production",
        dev_login_enabled=False,
        auth_secret="super-strong-production-secret-key-2026",
        allowed_origins=("https://verso.app",),
    )
    app = create_app(store=SessionStore(root_dir=tmp_path / "c", settings=good_prod))
    client = TestClient(app)
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.headers["x-content-type-options"] == "nosniff"
    assert res.headers["x-frame-options"] == "DENY"
    assert "strict-transport-security" in res.headers


def test_lru_cache_bounds_memory_entries(tmp_path: Path) -> None:
    store = SessionStore(
        root_dir=tmp_path,
        settings=_local_settings(max_cached_docs=2),
    )
    app = create_app(store=store)
    client = TestClient(app)

    for i in range(4):
        res = client.post(
            "/api/documents",
            files={"file": (f"doc_{i}.pdf", _make_pdf_bytes(f"Doc {i}"), "application/pdf")},
        )
        assert res.status_code == 200

    assert len(store._cache) <= 2


def test_cross_site_cookie_samesite_none_requires_secure(tmp_path: Path) -> None:
    bad_cookie = _local_settings(
        environment="production",
        dev_login_enabled=False,
        auth_secret="super-strong-production-secret-key-2026",
        allowed_origins=("https://verso.pages.dev",),
        cookie_samesite="none",
        cookie_secure=False,
    )
    with pytest.raises(RuntimeError, match="EDITPDF_COOKIE_SECURE"):
        create_app(store=SessionStore(root_dir=tmp_path / "bad", settings=bad_cookie))

    good_cookie = _local_settings(
        environment="production",
        dev_login_enabled=False,
        auth_secret="super-strong-production-secret-key-2026",
        allowed_origins=("https://verso.pages.dev",),
        cookie_samesite="none",
        cookie_secure=True,
    )
    app = create_app(store=SessionStore(root_dir=tmp_path / "ok", settings=good_cookie))
    client = TestClient(app)
    res = client.get("/api/auth/me")
    assert res.status_code == 200
    set_cookie = res.headers.get("set-cookie", "").lower()
    assert "samesite=none" in set_cookie
    assert "secure" in set_cookie
