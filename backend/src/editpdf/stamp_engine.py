"""Pixel extraction and background removal engine for turning logos/photos into stamps."""

from __future__ import annotations

import io
from typing import Literal

import cv2
import numpy as np
from PIL import Image, ImageOps

StampExtractMode = Literal["ink", "engraved", "cutout"]

_MAX_DIM = 1200


def _decode_rgba(raw: bytes) -> np.ndarray:
    """Decode image bytes with EXIF orientation applied and cap max dimension."""
    try:
        with Image.open(io.BytesIO(raw)) as img:
            img = ImageOps.exif_transpose(img)
            img = img.convert("RGBA")
            w, h = img.size
            if w == 0 or h == 0:
                raise ValueError("Image has zero dimensions.")
            if max(w, h) > _MAX_DIM:
                scale = _MAX_DIM / float(max(w, h))
                img = img.resize(
                    (max(1, int(round(w * scale))), max(1, int(round(h * scale)))),
                    Image.Resampling.LANCZOS,
                )
            return np.array(img, dtype=np.uint8)
    except ValueError:
        raise
    except Exception as exc:
        raise ValueError("Could not decode image file.") from exc


def _sample_border_lab(lab: np.ndarray) -> np.ndarray:
    """Return median LAB color sampled from the outer border strip of the image."""
    h, w = lab.shape[:2]
    band = max(2, min(8, min(h, w) // 16))
    top = lab[:band, :, :].reshape(-1, 3)
    bottom = lab[h - band :, :, :].reshape(-1, 3)
    left = lab[:, :band, :].reshape(-1, 3)
    right = lab[:, w - band :, :].reshape(-1, 3)
    border = np.concatenate([top, bottom, left, right], axis=0)
    return np.median(border, axis=0).astype(np.float32)


def _foreground_signal_lab(rgb: np.ndarray) -> tuple[np.ndarray, bool]:
    """Compute a 0..255 foreground strength map using illumination-corrected LAB distance.

    Returns (signal_u8, is_light_bg).
    """
    h, w = rgb.shape[:2]
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    bg_lab = _sample_border_lab(lab)
    is_light_bg = bool(bg_lab[0] >= 135.0)

    if is_light_bg:
        # Flat-field illumination normalization on L removes phone shadows & uneven lighting.
        k = max(31, (min(h, w) // 6) | 1)
        if k > min(h, w):
            k = max(3, (min(h, w) // 2) | 1)
        l_chan = lab[:, :, 0]
        bg_l = cv2.GaussianBlur(l_chan, (k, k), 0)
        # Preserve large solid shapes by blending local background with global border lightness.
        bg_l_ref = np.maximum(bg_l, bg_lab[0] * 0.72)
        l_norm = np.clip((l_chan / np.maximum(bg_l_ref, 1.0)) * bg_lab[0], 0.0, 255.0)

        # Also check direct delta from border lightness so large dark fills stay solid.
        dl_local = np.maximum(0.0, bg_lab[0] - l_norm)
        dl_global = np.maximum(0.0, bg_lab[0] - l_chan)
        dl = np.maximum(dl_local, dl_global * 0.85)

        da = lab[:, :, 1] - bg_lab[1]
        db = lab[:, :, 2] - bg_lab[2]
        chroma_dist = np.sqrt(da * da + db * db)
        dist = np.sqrt(dl * dl + 1.45 * chroma_dist * chroma_dist)
    else:
        # Dark or richly colored background (e.g. white logo on dark navy/black).
        dl = lab[:, :, 0] - bg_lab[0]
        da = lab[:, :, 1] - bg_lab[1]
        db = lab[:, :, 2] - bg_lab[2]
        dist = np.sqrt(dl * dl + 1.3 * da * da + 1.3 * db * db)

    # Scale perceptual distance so typical ink/logo strokes span 0..255 cleanly.
    p99 = float(np.percentile(dist, 99.5))
    denom = max(48.0, min(180.0, p99))
    signal = np.clip((dist / denom) * 255.0, 0.0, 255.0).astype(np.uint8)
    return signal, is_light_bg


def _soft_threshold(signal: np.ndarray, sensitivity: int) -> np.ndarray:
    """Convert 0..255 signal into a smooth anti-aliased 0..255 alpha mask.

    sensitivity: 0..100 (50 = balanced Otsu, higher captures fainter strokes).
    """
    otsu_val, _ = cv2.threshold(signal, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    base_thresh = float(np.clip(otsu_val, 26.0, 200.0))
    # Map sensitivity 0..100 -> shift from +65 (strict) to -65 (sensitive).
    shift = (50.0 - float(np.clip(sensitivity, 0, 100))) * 1.25
    thresh = float(np.clip(base_thresh + shift, 12.0, 235.0))

    # Smooth anti-aliased ramp of width ~26 gray levels around threshold.
    half_band = 13.0
    norm = (signal.astype(np.float32) - (thresh - half_band)) / (2.0 * half_band)
    alpha_f = np.clip(norm, 0.0, 1.0)
    return (alpha_f * 255.0).astype(np.uint8)


def _fill_interior_holes(alpha: np.ndarray) -> np.ndarray:
    """Keep exterior background transparent via border flood-fill, preserving interior shapes."""
    h, w = alpha.shape
    bg_binary = (alpha < 64).astype(np.uint8) * 255
    padded = np.zeros((h + 2, w + 2), dtype=np.uint8)
    padded[1:-1, 1:-1] = bg_binary
    # Flood-fill from outer border (0, 0) to mark true exterior background.
    flood = padded.copy()
    mask = np.zeros((h + 4, w + 4), dtype=np.uint8)
    cv2.floodFill(flood, mask, (0, 0), 128)
    exterior = flood[1:-1, 1:-1] == 128
    out = alpha.copy()
    # Any interior hole not connected to the border gets restored to solid ink.
    interior_hole = (~exterior) & (alpha < 64)
    out[interior_hole] = 255
    return out


def _engraved_detail(rgb: np.ndarray, subject_alpha: np.ndarray, sensitivity: int) -> np.ndarray:
    """Turn a shaded/colored emblem inside subject_alpha into crisp engraved seal line-art."""
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.4, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)

    # 1. Local adaptive detail (captures inner text, feathers, stars, hatching).
    h, w = gray.shape
    block = max(15, (min(h, w) // 24) | 1)
    c_bias = float(np.clip(14.0 - (sensitivity - 50) * 0.22, 2.0, 26.0))
    local_dark = cv2.adaptiveThreshold(
        enhanced,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        block,
        c_bias,
    )

    # 2. Sobel edge engraving so outlines of light/midtone features stay sharp.
    gx = cv2.Sobel(enhanced, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(enhanced, cv2.CV_32F, 0, 1, ksize=3)
    mag = cv2.magnitude(gx, gy)
    mag_u8 = np.clip((mag / max(1.0, float(np.percentile(mag, 98.5)))) * 255.0, 0, 255).astype(
        np.uint8
    )
    edge_thresh = int(np.clip(115 - (sensitivity - 50) * 1.1, 35, 195))
    edges = np.clip(
        (mag_u8.astype(np.float32) - (edge_thresh - 15)) / 30.0 * 255.0, 0, 255
    ).astype(np.uint8)

    # 3. Combine adaptive ink + crisp edges, masked tightly to the extracted subject.
    combined = np.maximum(local_dark, edges)
    # Softly smooth 1px jagged edges.
    combined = cv2.GaussianBlur(combined, (3, 3), 0)
    alpha = ((combined.astype(np.float32) / 255.0) * (subject_alpha.astype(np.float32) / 255.0))
    return np.clip(alpha * 255.0, 0, 255).astype(np.uint8)


def _grabcut_subject_mask(rgb: np.ndarray) -> np.ndarray:
    """Use OpenCV GrabCut with border background prior to isolate a photo subject."""
    h, w = rgb.shape[:2]
    # Run GrabCut at <= 480px for speed, then upsample smoothly.
    scale = min(1.0, 480.0 / float(max(h, w)))
    sw = max(16, int(round(w * scale)))
    sh = max(16, int(round(h * scale)))
    small_bgr = cv2.cvtColor(
        cv2.resize(rgb, (sw, sh), interpolation=cv2.INTER_AREA), cv2.COLOR_RGB2BGR
    )

    gc_mask = np.full((sh, sw), cv2.GC_PR_FGD, dtype=np.uint8)
    border = max(3, min(14, min(sh, sw) // 16))
    gc_mask[:border, :] = cv2.GC_BGD
    gc_mask[sh - border :, :] = cv2.GC_BGD
    gc_mask[:, :border] = cv2.GC_BGD
    gc_mask[:, sw - border :] = cv2.GC_BGD

    bgd_model = np.zeros((1, 65), np.float64)
    fgd_model = np.zeros((1, 65), np.float64)
    try:
        cv2.grabCut(
            small_bgr,
            gc_mask,
            (border, border, max(1, sw - 2 * border), max(1, sh - 2 * border)),
            bgd_model,
            fgd_model,
            4,
            cv2.GC_INIT_WITH_MASK,
        )
        fg = np.where((gc_mask == cv2.GC_FGD) | (gc_mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
    except cv2.error:
        fg = np.full((sh, sw), 255, dtype=np.uint8)

    # Upsample and feather slightly for anti-aliased cutout edges.
    fg_full = cv2.resize(fg, (w, h), interpolation=cv2.INTER_LINEAR)
    fg_full = cv2.GaussianBlur(fg_full, (5, 5), 0)
    return fg_full


def _clean_speckles(alpha: np.ndarray) -> np.ndarray:
    """Remove tiny isolated noise specks while preserving fine letters and punctuation."""
    h, w = alpha.shape
    binary = (alpha >= 48).astype(np.uint8)
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(binary, connectivity=8)
    if num_labels <= 1:
        return alpha
    min_area = max(3, int(round(h * w * 0.000025)))
    cleaned = alpha.copy()
    for lbl in range(1, num_labels):
        if int(stats[lbl, cv2.CC_STAT_AREA]) < min_area:
            cleaned[labels == lbl] = 0
    return cleaned


def _tight_crop_alpha(alpha: np.ndarray, pad: int = 8) -> np.ndarray:
    """Auto-crop the alpha mask tightly to non-transparent foreground pixels."""
    ys, xs = np.where(alpha >= 20)
    if ys.size == 0 or xs.size == 0:
        return alpha
    h, w = alpha.shape
    y0 = max(0, int(ys.min()) - pad)
    y1 = min(h, int(ys.max()) + 1 + pad)
    x0 = max(0, int(xs.min()) - pad)
    x1 = min(w, int(xs.max()) + 1 + pad)
    return alpha[y0:y1, x0:x1]


def extract_stamp_mask(
    raw: bytes,
    *,
    mode: StampExtractMode = "ink",
    sensitivity: int = 50,
    remove_inner_white: bool = True,
) -> tuple[bytes, int, int]:
    """Extract background-removed foreground pixels as a pure-white alpha mask PNG.

    Returns (png_bytes, width, height) where RGB is (255, 255, 255) and Alpha encodes
    anti-aliased stamp ink density (0..255).
    """
    rgba = _decode_rgba(raw)
    rgb = rgba[:, :, :3]
    src_alpha = rgba[:, :, 3]
    h, w = src_alpha.shape

    transparent_frac = float(np.mean(src_alpha < 245))
    has_transparency = transparent_frac >= 0.02

    if has_transparency:
        if mode == "engraved":
            # Composite onto white for clean luminance/edge analysis, then mask by source alpha.
            alpha_f = src_alpha.astype(np.float32)[:, :, None] / 255.0
            comp_rgb = (rgb.astype(np.float32) * alpha_f + 255.0 * (1.0 - alpha_f)).astype(np.uint8)
            alpha = _engraved_detail(comp_rgb, src_alpha, sensitivity)
        elif remove_inner_white:
            # Knock out near-white interior fills inside transparent PNGs when enabled.
            gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
            white_cutoff = int(np.clip(236 - (50 - sensitivity) * 0.7, 175, 250))
            darkness = np.clip((white_cutoff - gray.astype(np.float32)) / 24.0, 0.0, 1.0)
            # Only apply darkness cutout if the transparent PNG actually has dark strokes
            # (keeps white logos on transparent backgrounds intact!).
            opaque_pixels = gray[src_alpha > 128]
            if opaque_pixels.size > 0 and float(np.percentile(opaque_pixels, 20)) < 190.0:
                alpha = np.clip(src_alpha.astype(np.float32) * darkness, 0, 255).astype(np.uint8)
            else:
                alpha = src_alpha.copy()
        else:
            alpha = src_alpha.copy()
    elif mode == "cutout":
        subject_alpha = _grabcut_subject_mask(rgb)
        if remove_inner_white:
            alpha = _engraved_detail(rgb, subject_alpha, sensitivity)
        else:
            alpha = subject_alpha
    elif mode == "engraved":
        signal, _ = _foreground_signal_lab(rgb)
        subject_alpha = _fill_interior_holes(_soft_threshold(signal, min(95, sensitivity + 12)))
        # If subject filled almost the whole image (e.g. textured photo), fall back to full canvas.
        if float(np.mean(subject_alpha > 64)) < 0.01:
            subject_alpha = np.full((h, w), 255, dtype=np.uint8)
        alpha = _engraved_detail(rgb, subject_alpha, sensitivity)
    else:
        # Default "ink" mode: illumination-normalized LAB distance + soft anti-aliased threshold.
        signal, _ = _foreground_signal_lab(rgb)
        alpha = _soft_threshold(signal, sensitivity)
        if not remove_inner_white:
            alpha = _fill_interior_holes(alpha)

    alpha = _clean_speckles(alpha)
    alpha = _tight_crop_alpha(alpha, pad=8)

    ch, cw = alpha.shape
    out_rgba = np.empty((ch, cw, 4), dtype=np.uint8)
    out_rgba[:, :, :3] = 255
    out_rgba[:, :, 3] = alpha

    buf = io.BytesIO()
    Image.fromarray(out_rgba, mode="RGBA").save(buf, format="PNG", optimize=True)
    return buf.getvalue(), cw, ch
