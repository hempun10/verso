"""Tests for uploading PNG/JPG images to edit their text via the OCR engine."""

from __future__ import annotations

import io
from pathlib import Path

from fastapi.testclient import TestClient
from PIL import Image, ImageDraw, ImageFont

from editpdf.api import create_app
from editpdf.service import SessionStore


def _make_text_png(text: str = "Invoice Total 250") -> bytes:
    img = Image.new("RGB", (900, 320), (255, 255, 255))
    draw = ImageDraw.Draw(img)
    font = None
    for path in (
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ):
        if Path(path).exists():
            font = ImageFont.truetype(path, 56)
            break
    draw.text((60, 120), text, fill=(18, 20, 24), font=font or ImageFont.load_default())
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_upload_png_detects_ocr_text_and_exports_edited_image_and_pdf(tmp_path: Path) -> None:
    store = SessionStore(root_dir=tmp_path)
    app = create_app(store=store)
    client = TestClient(app)

    png_bytes = _make_text_png("Invoice Total 250")
    up = client.post(
        "/api/documents",
        files={"file": ("receipt.png", png_bytes, "image/png")},
    )
    assert up.status_code == 200
    summary = up.json()
    assert summary["filename"] == "receipt.png"
    assert summary["page_count"] == 1
    assert summary["pages"][0]["kind"] == "scanned"

    doc_id = summary["doc_id"]
    blocks_res = client.get(f"/api/documents/{doc_id}/pages/0/blocks")
    assert blocks_res.status_code == 200
    blocks = blocks_res.json()
    assert len(blocks) >= 1
    joined = " ".join(b["text"] for b in blocks)
    assert "Invoice" in joined or "Total" in joined

    target_block = blocks[0]
    edit = {"block_id": target_block["id"], "new_text": "Paid Total 999"}

    # Export as edited PNG image
    img_res = client.post(
        f"/api/documents/{doc_id}/export-image",
        json={"page_index": 0, "edits": [edit], "overlays": [], "dpi": 200},
    )
    assert img_res.status_code == 200
    assert img_res.headers["content-type"] == "image/png"
    assert img_res.content.startswith(b"\x89PNG\r\n\x1a\n")

    # Also supports exporting the edited image as PDF
    pdf_res = client.post(
        f"/api/documents/{doc_id}/export",
        json={"edits": [edit], "overlays": []},
    )
    assert pdf_res.status_code == 200
    assert pdf_res.headers["content-type"] == "application/pdf"
    assert pdf_res.content.startswith(b"%PDF")
