"""Tests for image/logo to government stamp pixel extraction."""

from __future__ import annotations

import io
from pathlib import Path

import numpy as np
from fastapi.testclient import TestClient
from PIL import Image, ImageDraw

from editpdf.api import create_app
from editpdf.service import SessionStore
from editpdf.stamp_engine import extract_stamp_mask


def _make_logo_on_paper(shaded: bool = False) -> bytes:
    """Create a synthetic logo/crest on a white or unevenly shaded paper background."""
    w, h = 400, 400
    if shaded:
        # Horizontal illumination gradient from warm light paper to shadowed paper.
        grad = np.linspace(245, 185, w, dtype=np.float32)[None, :]
        arr = np.stack([grad, grad * 0.98, grad * 0.95], axis=-1)
        arr = np.broadcast_to(arr, (h, w, 3)).astype(np.uint8).copy()
        img = Image.fromarray(arr, mode="RGB")
    else:
        img = Image.new("RGB", (w, h), "white")

    draw = ImageDraw.Draw(img)
    # Draw an official-looking double circle + inner star/cross emblem in dark navy.
    draw.ellipse((80, 80, 320, 320), outline=(20, 45, 110), width=12)
    draw.ellipse((110, 110, 290, 290), outline=(20, 45, 110), width=5)
    draw.polygon([(200, 130), (245, 255), (140, 180), (260, 180), (155, 255)], fill=(20, 45, 110))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_extract_stamp_mask_removes_white_background_and_crops():
    raw = _make_logo_on_paper(shaded=False)
    mask_png, cw, ch = extract_stamp_mask(raw, mode="ink", sensitivity=50, remove_inner_white=True)

    with Image.open(io.BytesIO(mask_png)) as out:
        assert out.mode == "RGBA"
        assert out.size == (cw, ch)
        # Cropped tightly around the 240px emblem (not full 400x400 canvas).
        assert 220 <= cw <= 290
        assert 220 <= ch <= 290
        arr = np.array(out)
        # Corners outside the circle must be transparent.
        assert int(arr[2, 2, 3]) == 0
        # Output RGB channels must be pure white (tintable mask).
        assert int(arr[:, :, 0].min()) == 255
        # Significant opaque ink pixels must exist.
        assert float(np.mean(arr[:, :, 3] > 200)) > 0.15


def test_extract_stamp_mask_handles_shaded_paper_and_engraved_mode():
    raw = _make_logo_on_paper(shaded=True)
    for mode in ("ink", "engraved", "cutout"):
        mask_png, cw, ch = extract_stamp_mask(
            raw,
            mode=mode,  # type: ignore[arg-type]
            sensitivity=50,
            remove_inner_white=True,
        )
        with Image.open(io.BytesIO(mask_png)) as out:
            arr = np.array(out)
            assert cw > 100 and ch > 100
            assert int(arr[1, 1, 3]) == 0
            assert float(np.mean(arr[:, :, 3] > 150)) > 0.05


def test_extract_stamp_api_endpoint_and_validation(tmp_path: Path):
    store = SessionStore(root_dir=tmp_path)
    app = create_app(store=store)
    client = TestClient(app)

    raw = _make_logo_on_paper(shaded=False)
    res = client.post(
        "/api/stamps/extract?mode=ink&sensitivity=55&remove_inner_white=true",
        files={"file": ("logo.png", raw, "image/png")},
    )
    assert res.status_code == 200
    assert res.headers["content-type"] == "image/png"
    assert int(res.headers["x-stamp-width"]) > 150
    assert int(res.headers["x-stamp-height"]) > 150
    assert res.content.startswith(b"\x89PNG\r\n\x1a\n")

    # Reject non-image uploads cleanly.
    bad = client.post(
        "/api/stamps/extract",
        files={"file": ("fake.png", b"not-an-image-payload", "image/png")},
    )
    assert bad.status_code == 400
