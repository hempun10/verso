"""Tests for whiteout and image (signature/watermark) overlays."""

from __future__ import annotations

import base64
import io
from pathlib import Path

import numpy as np
import pymupdf
from fastapi.testclient import TestClient
from PIL import Image

from editpdf.api import create_app
from editpdf.models import ImageOverlay, WhiteoutOverlay
from editpdf.overlays import apply_page_overlays
from editpdf.service import SessionStore


def _make_sample_pdf() -> bytes:
    doc = pymupdf.open()
    page = doc.new_page(width=612, height=792)
    page.insert_text((72, 120), "CONFIDENTIAL SECRET", fontsize=24, color=(0, 0, 0))
    page.insert_text((72, 220), "Keep Visible Line", fontsize=18, color=(0, 0, 0))
    out = doc.tobytes()
    doc.close()
    return out


def _make_red_stamp_data_url() -> str:
    img = Image.new("RGBA", (120, 40), (220, 38, 38, 255))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{b64}"


def test_whiteout_rect_covers_underlying_text():
    raw = _make_sample_pdf()
    with pymupdf.open(stream=raw, filetype="pdf") as doc:
        page = doc[0]
        apply_page_overlays(
            page,
            0,
            [
                WhiteoutOverlay(
                    id="w1",
                    page_index=0,
                    bbox=(68.0, 95.0, 360.0, 130.0),
                    fill_hex="#ffffff",
                    shape="rect",
                )
            ],
        )
        pix = page.get_pixmap(dpi=150, alpha=False)
        arr = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
        sx = pix.width / page.rect.width
        sy = pix.height / page.rect.height
        covered = arr[int(100 * sy) : int(125 * sy), int(72 * sx) : int(340 * sx), :3]
        # Covered area should be completely white.
        assert float(covered.mean()) > 254.0

        # Untouched text below should still have dark ink pixels.
        kept = arr[int(200 * sy) : int(230 * sy), int(72 * sx) : int(260 * sx), :3]
        assert int((kept.mean(axis=2) < 80).sum()) > 50


def test_whiteout_ellipse_and_rotated_watermark_image_api(tmp_path: Path):
    store = SessionStore(root_dir=tmp_path)
    client = TestClient(create_app(store=store))
    raw = _make_sample_pdf()

    upload_res = client.post(
        "/api/documents",
        files={"file": ("doc.pdf", raw, "application/pdf")},
    )
    assert upload_res.status_code == 200
    doc_id = upload_res.json()["doc_id"]

    overlays = [
        WhiteoutOverlay(
            id="w_oval",
            page_index=0,
            bbox=(65.0, 92.0, 365.0, 132.0),
            fill_hex="#ffffff",
            shape="ellipse",
        ).model_dump(),
        ImageOverlay(
            id="img_wm",
            page_index=0,
            bbox=(180.0, 300.0, 420.0, 380.0),
            data_url=_make_red_stamp_data_url(),
            opacity=0.35,
            angle_deg=-30.0,
        ).model_dump(),
    ]

    preview_res = client.post(
        f"/api/documents/{doc_id}/preview",
        json={"page_index": 0, "edits": [], "overlays": overlays, "dpi": 150},
    )
    assert preview_res.status_code == 200
    assert preview_res.content.startswith(b"\x89PNG")

    export_res = client.post(
        f"/api/documents/{doc_id}/export",
        json={"edits": [], "overlays": overlays},
    )
    assert export_res.status_code == 200
    with pymupdf.open(stream=export_res.content, filetype="pdf") as out_doc:
        page = out_doc[0]
        # Watermark image should be embedded on the exported page.
        assert len(page.get_images(full=True)) >= 1
        pix = page.get_pixmap(dpi=150, alpha=False)
        arr = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
        sx = pix.width / page.rect.width
        sy = pix.height / page.rect.height
        # Center of watermark region (300, 340) should show soft pink/red tint (opacity ~0.35).
        cx, cy = int(300 * sx), int(340 * sy)
        patch = arr[cy - 10 : cy + 10, cx - 10 : cx + 10, :3]
        assert float(patch[:, :, 0].mean()) > float(patch[:, :, 1].mean()) + 40.0
        # Because opacity is 0.35 on white bg, green channel stays relatively high (~160-190).
        assert 120.0 < float(patch[:, :, 1].mean()) < 220.0


def test_image_overlay_crop_keeps_only_cropped_region():
    # Build a 100x50 image whose left half is pure red and right half is pure blue.
    img = Image.new("RGBA", (100, 50), (0, 0, 255, 255))
    for y in range(50):
        for x in range(50):
            img.putpixel((x, y), (220, 20, 20, 255))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    data_url = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")

    raw = _make_sample_pdf()
    with pymupdf.open(stream=raw, filetype="pdf") as doc:
        page = doc[0]
        apply_page_overlays(
            page,
            0,
            [
                ImageOverlay(
                    id="img_crop",
                    page_index=0,
                    bbox=(100.0, 300.0, 200.0, 400.0),
                    data_url=data_url,
                    opacity=1.0,
                    angle_deg=0.0,
                    crop=(0.0, 0.0, 0.5, 1.0),  # left red half only
                )
            ],
        )
        pix = page.get_pixmap(dpi=150, alpha=False)
        arr = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
        sx = pix.width / page.rect.width
        sy = pix.height / page.rect.height
        region = arr[int(310 * sy) : int(390 * sy), int(110 * sx) : int(190 * sx), :3]
        # Entire rendered region should be red with virtually no blue.
        assert float(region[:, :, 0].mean()) > 190.0
        assert float(region[:, :, 2].mean()) < 50.0
