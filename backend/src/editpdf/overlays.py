"""Vector whiteout and image overlays (signatures, stamps, watermarks) applied to PDF pages."""

from __future__ import annotations

import base64
import io
import math
from collections.abc import Callable

import numpy as np
import pymupdf
from PIL import Image

from editpdf.models import ImageOverlay, PageOverlay, WhiteoutOverlay
from editpdf.native_engine import hex_to_rgb_float

AssetBytesLoader = Callable[[str], bytes | None]

MAX_OVERLAY_IMAGE_DIM = 2400


def _decode_data_url(data_url: str) -> bytes:
    raw = data_url.strip()
    if "," in raw and raw.lower().startswith("data:"):
        raw = raw.split(",", 1)[1]
    return base64.b64decode(raw)


def _apply_whiteout(page: pymupdf.Page, overlay: WhiteoutOverlay) -> None:
    x0, y0, x1, y1 = overlay.bbox
    rect = pymupdf.Rect(min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1))
    if rect.width <= 0.5 or rect.height <= 0.5:
        return
    fill_rgb = hex_to_rgb_float(overlay.fill_hex)
    if overlay.shape == "ellipse":
        page.draw_oval(rect, color=None, fill=fill_rgb)
    else:
        page.draw_rect(rect, color=None, fill=fill_rgb)


def _apply_image(
    page: pymupdf.Page,
    overlay: ImageOverlay,
    asset_loader: AssetBytesLoader | None = None,
) -> None:
    x0, y0, x1, y1 = overlay.bbox
    rect = pymupdf.Rect(min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1))
    if rect.width <= 1.0 or rect.height <= 1.0:
        return

    try:
        img_bytes: bytes | None = None
        if overlay.asset_id and asset_loader is not None:
            img_bytes = asset_loader(overlay.asset_id)
        if img_bytes is None and overlay.data_url:
            img_bytes = _decode_data_url(overlay.data_url)
        if not img_bytes:
            return
        img = Image.open(io.BytesIO(img_bytes)).convert("RGBA")
    except Exception:
        return

    # Apply normalized source crop [left, top, right, bottom] in [0..1] if set.
    if overlay.crop is not None:
        cx0, cy0, cx1, cy1 = overlay.crop
        iw, ih = img.size
        px0 = max(0, min(iw - 1, int(round(cx0 * iw))))
        py0 = max(0, min(ih - 1, int(round(cy0 * ih))))
        px1 = max(px0 + 1, min(iw, int(round(cx1 * iw))))
        py1 = max(py0 + 1, min(ih, int(round(cy1 * ih))))
        img = img.crop((px0, py0, px1, py1))

    # Scale alpha channel when opacity < 1 (e.g. watermarks).
    if overlay.opacity < 0.999:
        arr = np.asarray(img, dtype=np.uint8).copy()
        arr[:, :, 3] = np.clip(
            np.round(arr[:, :, 3].astype(np.float32) * overlay.opacity), 0, 255
        ).astype(np.uint8)
        img = Image.fromarray(arr, mode="RGBA")

    target_rect = rect
    if abs(overlay.angle_deg) > 0.1:
        # Match target box aspect ratio before rotating so non-uniform resizes don't shear.
        render_scale = min(3.0, MAX_OVERLAY_IMAGE_DIM / max(rect.width, rect.height, 1.0))
        pw = max(2, int(round(rect.width * render_scale)))
        ph = max(2, int(round(rect.height * render_scale)))
        img = img.resize((pw, ph), Image.Resampling.LANCZOS)
        # PIL rotates counter-clockwise; negate to match CSS clockwise rotate().
        img = img.rotate(-overlay.angle_deg, resample=Image.Resampling.BICUBIC, expand=True)

        rad = math.radians(overlay.angle_deg)
        cos_a = abs(math.cos(rad))
        sin_a = abs(math.sin(rad))
        exp_w = rect.width * cos_a + rect.height * sin_a
        exp_h = rect.width * sin_a + rect.height * cos_a
        cx = (rect.x0 + rect.x1) / 2.0
        cy = (rect.y0 + rect.y1) / 2.0
        target_rect = pymupdf.Rect(
            cx - exp_w / 2.0,
            cy - exp_h / 2.0,
            cx + exp_w / 2.0,
            cy + exp_h / 2.0,
        )

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    page.insert_image(target_rect, stream=buf.getvalue(), keep_proportion=False, overlay=True)


def apply_page_overlays(
    page: pymupdf.Page,
    page_index: int,
    overlays: list[PageOverlay],
    asset_loader: AssetBytesLoader | None = None,
) -> None:
    """Apply whiteout shapes and image overlays (signatures, watermarks) onto a page."""
    for overlay in overlays:
        if overlay.page_index != page_index:
            continue
        if isinstance(overlay, WhiteoutOverlay):
            _apply_whiteout(page, overlay)
        elif isinstance(overlay, ImageOverlay):
            _apply_image(page, overlay, asset_loader=asset_loader)
