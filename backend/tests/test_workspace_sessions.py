"""Tests for auth, multi-user workspaces, saved sessions, share links, and saved assets."""

from __future__ import annotations

import base64
import io
from pathlib import Path

import pymupdf
from fastapi.testclient import TestClient
from PIL import Image

from editpdf.api import create_app
from editpdf.service import SessionStore


def _make_pdf(text: str = "Contract Draft") -> bytes:
    doc = pymupdf.open()
    p = doc.new_page(width=612, height=792)
    p.insert_text((72, 120), text, fontsize=18)
    raw = doc.tobytes()
    doc.close()
    return raw


def _make_signature_data_url() -> str:
    img = Image.new("RGBA", (180, 60), (0, 0, 0, 0))
    for x in range(20, 160):
        img.putpixel((x, 30), (17, 24, 39, 255))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def _login(client: TestClient, email: str, name: str) -> dict[str, str]:
    res = client.post("/api/auth/dev-login", json={"email": email, "name": name})
    assert res.status_code == 200
    token = res.json()["token"]
    return {"Authorization": f"Bearer {token}"}


def test_multi_user_isolation_saved_session_and_share_link(tmp_path: Path):
    store = SessionStore(root_dir=tmp_path)
    client = TestClient(create_app(store=store))

    alice = _login(client, "alice@example.com", "Alice")
    bob = _login(client, "bob@example.com", "Bob")

    # Alice uploads a PDF and saves a signature asset.
    up = client.post(
        "/api/documents",
        headers=alice,
        files={"file": ("nda.pdf", _make_pdf("Agreement v1"), "application/pdf")},
    )
    assert up.status_code == 200
    doc_id = up.json()["doc_id"]

    sig_res = client.post(
        "/api/assets",
        headers=alice,
        json={"kind": "signature", "name": "Alice Sig", "data_url": _make_signature_data_url()},
    )
    assert sig_res.status_code == 200
    sig_asset = sig_res.json()
    assert sig_asset["kind"] == "signature"

    # Bob cannot see Alice's documents, signatures, or private document detail.
    assert client.get("/api/documents", headers=bob).json() == []
    assert client.get("/api/assets?kind=signature", headers=bob).json() == []
    assert client.get(f"/api/documents/{doc_id}", headers=bob).status_code == 403

    # Alice saves a text edit + her saved signature overlay (referenced by asset_id).
    blocks = client.get(f"/api/documents/{doc_id}/pages/0/blocks", headers=alice).json()
    block_id = blocks[0]["id"]
    save_res = client.put(
        f"/api/documents/{doc_id}/state",
        headers=alice,
        json={
            "edits": [{"block_id": block_id, "new_text": "Agreement Signed"}],
            "overlays": [
                {
                    "id": "ov_sig1",
                    "kind": "image",
                    "page_index": 0,
                    "bbox": [72, 200, 220, 250],
                    "asset_id": sig_asset["asset_id"],
                    "opacity": 1.0,
                    "angle_deg": 0.0,
                }
            ],
        },
    )
    assert save_res.status_code == 200
    assert save_res.json()["version"] == 2

    # Simulate server restart with fresh SessionStore on same root_dir: state & assets persist!
    restarted_client = TestClient(create_app(store=SessionStore(root_dir=tmp_path)))
    detail = restarted_client.get(f"/api/documents/{doc_id}", headers=alice).json()
    assert detail["edits"][0]["new_text"] == "Agreement Signed"
    assert detail["overlays"][0]["asset_id"] == sig_asset["asset_id"]

    # Export with asset_id-backed image overlay succeeds and embeds the signature image!
    exp = restarted_client.post(
        f"/api/documents/{doc_id}/export",
        headers=alice,
        json={"edits": detail["edits"], "overlays": detail["overlays"]},
    )
    assert exp.status_code == 200
    with pymupdf.open(stream=exp.content, filetype="pdf") as out_doc:
        assert "Agreement Signed" in str(out_doc[0].get_text()).replace("\u00a0", " ")
        assert len(out_doc[0].get_images(full=True)) >= 1

    # Alice enables sharing -> Bob can open, add a whiteout, and save non-realtime!
    share_res = restarted_client.post(
        f"/api/documents/{doc_id}/share",
        headers=alice,
        json={"is_shared": True},
    )
    assert share_res.status_code == 200
    share_token = share_res.json()["share_token"]
    assert share_token

    bob_doc = restarted_client.get(
        f"/api/documents/{doc_id}?share_token={share_token}",
        headers=bob,
    )
    assert bob_doc.status_code == 200
    assert bob_doc.json()["is_owner"] is False

    bob_save = restarted_client.put(
        f"/api/documents/{doc_id}/state?share_token={share_token}",
        headers=bob,
        json={
            "edits": [{"block_id": block_id, "new_text": "Agreement Countersigned"}],
            "overlays": detail["overlays"],
        },
    )
    assert bob_save.status_code == 200
    assert bob_save.json()["updated_by"] == "Bob"

    # Alice reloads and sees Bob's saved change.
    alice_latest = restarted_client.get(f"/api/documents/{doc_id}", headers=alice).json()
    assert alice_latest["edits"][0]["new_text"] == "Agreement Countersigned"
    assert alice_latest["updated_by"] == "Bob"

    # Alice disables sharing -> Bob's token is immediately rejected.
    revoked = restarted_client.post(
        f"/api/documents/{doc_id}/share",
        headers=alice,
        json={"is_shared": False},
    )
    assert revoked.status_code == 200
    assert (
        restarted_client.get(
            f"/api/documents/{doc_id}?share_token={share_token}", headers=bob
        ).status_code
        == 403
    )
