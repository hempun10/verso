"""Tests for Google Drive–style folders and moving documents between folders."""

from __future__ import annotations

from pathlib import Path

import pymupdf
from fastapi.testclient import TestClient

from editpdf.api import create_app
from editpdf.service import SessionStore


def _make_pdf_bytes(text: str = "Folder test document") -> bytes:
    doc = pymupdf.open()
    page = doc.new_page(width=400, height=300)
    page.insert_text((40, 80), text, fontsize=14, fontname="helv")
    raw = doc.tobytes()
    doc.close()
    return raw


def test_folder_crud_nesting_upload_move_and_safe_delete(tmp_path: Path) -> None:
    store = SessionStore(root_dir=tmp_path)
    app = create_app(store=store)
    client = TestClient(app)

    # Create top-level folder and nested child folder.
    root_res = client.post("/api/folders", json={"name": "Contracts"})
    assert root_res.status_code == 200
    root_folder = root_res.json()
    assert root_folder["name"] == "Contracts"
    assert root_folder["parent_id"] is None

    sub_res = client.post(
        "/api/folders",
        json={"name": "2026", "parent_id": root_folder["folder_id"]},
    )
    assert sub_res.status_code == 200
    sub_folder = sub_res.json()
    assert sub_folder["parent_id"] == root_folder["folder_id"]

    # Upload a PDF directly into the nested folder.
    up_res = client.post(
        "/api/documents",
        files={"file": ("lease.pdf", _make_pdf_bytes(), "application/pdf")},
        data={"folder_id": sub_folder["folder_id"]},
    )
    assert up_res.status_code == 200
    doc_id = up_res.json()["doc_id"]

    docs = client.get("/api/documents").json()
    assert len(docs) == 1
    assert docs[0]["doc_id"] == doc_id
    assert docs[0]["folder_id"] == sub_folder["folder_id"]

    # Prevent moving parent folder into its own descendant (cycle check).
    cycle_res = client.patch(
        f"/api/folders/{root_folder['folder_id']}",
        json={"parent_id": sub_folder["folder_id"], "move_parent": True},
    )
    assert cycle_res.status_code == 400

    # Rename child folder.
    ren_res = client.patch(
        f"/api/folders/{sub_folder['folder_id']}",
        json={"name": "2026 Signed"},
    )
    assert ren_res.status_code == 200
    assert ren_res.json()["name"] == "2026 Signed"

    # Deleting the child folder moves its PDF up to the parent folder safely.
    del_res = client.delete(f"/api/folders/{sub_folder['folder_id']}")
    assert del_res.status_code == 200
    docs_after = client.get("/api/documents").json()
    assert docs_after[0]["folder_id"] == root_folder["folder_id"]

    # Move document back to root (My Drive).
    move_res = client.patch(
        f"/api/documents/{doc_id}/folder",
        json={"folder_id": None},
    )
    assert move_res.status_code == 200
    docs_root = client.get("/api/documents").json()
    assert docs_root[0]["folder_id"] is None

    # Storage endpoint reports real byte usage for the uploaded PDF.
    st_res = client.get("/api/storage")
    assert st_res.status_code == 200
    st = st_res.json()
    assert st["used_bytes"] > 0
    assert st["quota_bytes"] >= st["used_bytes"]
    assert st["document_count"] == 1
    assert st["asset_count"] == 0
