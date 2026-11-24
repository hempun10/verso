"""Scanned PDF OCR extraction, ink/style matching, inpainting, and scan-matched rendering."""

from __future__ import annotations

import io
import math
from functools import lru_cache
from typing import Protocol

import cv2
import numpy as np
import pymupdf
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from rapidocr_onnxruntime import RapidOCR

from editpdf.fonts import resolve_font_for_edit
from editpdf.models import TextBlock, TextEdit, TextRun, TextStyle
from editpdf.native_engine import hex_to_rgb_float

SCAN_WORK_DPI = 250


class Inpainter(Protocol):
    """Protocol for background text removal (OpenCV Telea in v1; LaMa ONNX drop-in later)."""

    def inpaint(self, rgb: np.ndarray, mask: np.ndarray) -> np.ndarray: ...


class OpenCVInpainter:
    def __init__(self, radius: int = 4):
        self.radius = radius

    def inpaint(self, rgb: np.ndarray, mask: np.ndarray) -> np.ndarray:
        bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
        restored = cv2.inpaint(bgr, mask, self.radius, cv2.INPAINT_TELEA)
        return cv2.cvtColor(restored, cv2.COLOR_BGR2RGB)


@lru_cache(maxsize=1)
def _get_ocr() -> RapidOCR:
    return RapidOCR()


def extract_page_raster(page: pymupdf.Page, dpi: int = SCAN_WORK_DPI) -> np.ndarray:
    """Return high-resolution RGB numpy array for a scanned page."""
    pix = page.get_pixmap(dpi=dpi, alpha=False)
    arr = np.frombuffer(pix.samples, dtype=np.uint8)
    return arr.reshape(pix.height, pix.width, pix.n)[:, :, :3].copy()


def _compute_ink_mask(crop_rgb: np.ndarray) -> np.ndarray:
    """Segment dark foreground ink pixels inside a text crop using Otsu thresholding."""
    gray = cv2.cvtColor(crop_rgb, cv2.COLOR_RGB2GRAY)
    # Invert if background is darker than ink (light text on dark header).
    border = np.concatenate([gray[0, :], gray[-1, :], gray[:, 0], gray[:, -1]])
    bg_luma = float(np.median(border)) if border.size else 255.0
    if bg_luma < 128.0:
        _t, mask = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    else:
        _t, mask = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    return mask


def _sample_core_ink_hex(crop_rgb: np.ndarray, mask: np.ndarray, *, dark_bg: bool) -> str:
    """Sample true toner/ink core color (darkest 30% on light paper) instead of gray fringes."""
    ink_pixels = crop_rgb[mask > 0]
    if ink_pixels.size == 0:
        return "#f5f5f5" if dark_bg else "#141414"
    luma = (
        0.299 * ink_pixels[:, 0].astype(np.float32)
        + 0.587 * ink_pixels[:, 1].astype(np.float32)
        + 0.114 * ink_pixels[:, 2].astype(np.float32)
    )
    if dark_bg:
        cutoff = float(np.percentile(luma, 70))
        core = ink_pixels[luma >= cutoff]
    else:
        cutoff = float(np.percentile(luma, 30))
        core = ink_pixels[luma <= cutoff]
    sample = core if core.size > 0 else ink_pixels
    med = np.median(sample, axis=0).astype(int)
    return f"#{med[0]:02x}{med[1]:02x}{med[2]:02x}"


def _measure_projection_metrics(
    mask: np.ndarray,
) -> tuple[int, int, int, float, float]:
    """Return (cap_top, body_top, baseline_y, base_to_mid_ratio, x_to_cap_ratio) from ink mask."""
    ink = (mask > 0).astype(np.uint8)
    h = max(ink.shape[0], 1)
    row_sums = ink.sum(axis=1).astype(np.float64)
    max_r = float(row_sums.max()) if row_sums.size else 0.0
    if max_r <= 0.0:
        return 0, 0, max(0, h - 1), 1.0, 0.72

    body = np.where(row_sums >= 0.35 * max_r)[0]
    cap_rows = np.where(row_sums >= 0.04 * max_r)[0]
    body_top = int(body[0]) if body.size else 0
    baseline_y = int(body[-1]) if body.size else max(0, h - 1)
    cap_top = int(cap_rows[0]) if cap_rows.size else body_top

    x_h = max(1, baseline_y - body_top + 1)
    cap_h = max(1, baseline_y - cap_top + 1)
    mid_lo = body_top + max(1, int(x_h * 0.20))
    mid_hi = max(mid_lo + 1, baseline_y - max(1, int(x_h * 0.20)))
    mid_slice = row_sums[mid_lo:mid_hi]
    mid_mean = float(mid_slice.mean()) if mid_slice.size else max_r
    base_slice = row_sums[max(0, baseline_y - 1) : min(h, baseline_y + 2)]
    base_peak = float(base_slice.max()) if base_slice.size else mid_mean

    base_ratio = base_peak / max(mid_mean, 1.0)
    x_ratio = x_h / max(cap_h, 1)
    return cap_top, body_top, baseline_y, base_ratio, x_ratio


def _estimate_ink_style(
    crop_rgb: np.ndarray,
    crop_pt_height: float,
    text: str,
) -> tuple[str, float, str, bool, bool, bool, bool, float]:
    """Estimate (color_hex, font_size_pt, family, bold, italic, serif, mono, baseline_frac)."""
    gray = cv2.cvtColor(crop_rgb, cv2.COLOR_RGB2GRAY)
    border = np.concatenate([gray[0, :], gray[-1, :], gray[:, 0], gray[:, -1]])
    dark_bg = (float(np.median(border)) if border.size else 255.0) < 128.0
    mask = _compute_ink_mask(crop_rgb)

    color_hex = _sample_core_ink_hex(crop_rgb, mask, dark_bg=dark_bg)
    h_px = max(crop_rgb.shape[0], 1)
    cap_top, body_top, baseline_y, base_ratio, x_ratio = _measure_projection_metrics(mask)

    cap_h_px = max(1, baseline_y - cap_top + 1)
    x_h_px = max(1, baseline_y - body_top + 1)
    has_cap_or_asc = any(ch.isupper() or ch.isdigit() or ch in "bdfhklt" for ch in text)
    em_px = (cap_h_px / 0.70) if has_cap_or_asc else (x_h_px / 0.50)
    pt_per_px = crop_pt_height / h_px
    est_size_pt = max(6.0, min(144.0, round(em_px * pt_per_px, 1)))
    baseline_frac = (baseline_y + 0.5) / h_px

    # Estimate weight via distance transform relative to typographic cap height.
    dist = cv2.distanceTransform((mask > 0).astype(np.uint8), cv2.DIST_L2, 3)
    nonzero_dist = dist[dist > 0]
    stroke_ratio = (
        float(np.percentile(nonzero_dist, 80)) * 2.0 / max(cap_h_px, 1)
        if nonzero_dist.size
        else 0.10
    )
    bold = stroke_ratio > 0.15

    # Serif detection: baseline foot flare (adjusted for stroke weight) + lower x-height ratio.
    serif = base_ratio > (1.24 if bold else 1.44) or (x_ratio < 0.70 and base_ratio > 1.24)
    family = "times" if serif else "helvetica"
    return color_hex, est_size_pt, family, bold, False, serif, False, baseline_frac


def extract_scanned_blocks(page: pymupdf.Page, page_index: int) -> list[TextBlock]:
    """Run OCR on a scanned page and map detected text regions into unified TextBlocks."""
    rgb = extract_page_raster(page, dpi=SCAN_WORK_DPI)
    h_px, w_px, _ = rgb.shape
    pt_per_px_x = page.rect.width / max(w_px, 1)
    pt_per_px_y = page.rect.height / max(h_px, 1)

    ocr = _get_ocr()
    raw_results, _elapsed = ocr(rgb)
    if not raw_results:
        return []

    blocks: list[TextBlock] = []
    for idx, entry in enumerate(raw_results):
        poly, text, conf = entry
        cleaned = str(text).strip()
        if not cleaned:
            continue

        xs = [float(p[0]) for p in poly]
        ys = [float(p[1]) for p in poly]
        px0 = max(0, int(math.floor(min(xs))))
        py0 = max(0, int(math.floor(min(ys))))
        px1 = min(w_px, int(math.ceil(max(xs))))
        py1 = min(h_px, int(math.ceil(max(ys))))
        if px1 - px0 < 4 or py1 - py0 < 4:
            continue

        x0_pt = px0 * pt_per_px_x
        y0_pt = py0 * pt_per_px_y
        x1_pt = px1 * pt_per_px_x
        y1_pt = py1 * pt_per_px_y

        crop = rgb[py0:py1, px0:px1]
        color_hex, font_size_pt, family, bold, italic, serif, mono, baseline_frac = (
            _estimate_ink_style(crop, y1_pt - y0_pt, cleaned)
        )
        baseline_y_pt = y0_pt + (y1_pt - y0_pt) * baseline_frac

        blocks.append(
            TextBlock(
                id=f"p{page_index}_s{idx}",
                page_index=page_index,
                kind="scanned",
                text=cleaned,
                bbox=(round(x0_pt, 2), round(y0_pt, 2), round(x1_pt, 2), round(y1_pt, 2)),
                origin=(round(x0_pt, 2), round(baseline_y_pt, 2)),
                angle_deg=0.0,
                font_xref=None,
                style=TextStyle(
                    font_family=family,
                    original_font_name="inferred",
                    font_source="system",
                    font_size_pt=font_size_pt,
                    color_hex=color_hex,
                    bold=bold,
                    italic=italic,
                    serif=serif,
                    mono=mono,
                    confidence=round(float(conf), 3),
                ),
            )
        )

    return blocks


def _estimate_local_blur_sigma(crop_rgb: np.ndarray) -> float:
    """Map Laplacian edge sharpness of original scan crop to a small Gaussian blur sigma."""
    gray = cv2.cvtColor(crop_rgb, cv2.COLOR_RGB2GRAY)
    lap_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    # Crisp digital renders have very high Laplacian variance (>2000); soft scans are 100-900.
    if lap_var > 2200:
        return 0.15
    if lap_var > 900:
        return 0.45
    return 0.75


def _estimate_local_paper_noise(bg_rgb: np.ndarray) -> float:
    """Measure paper grain luminance std dev after inpainting so new ink matches scan texture."""
    gray = cv2.cvtColor(bg_rgb, cv2.COLOR_RGB2GRAY).astype(np.float32)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    residual = gray - blurred
    return float(min(10.0, np.std(residual)))


def _scanned_effective_runs(edit: TextEdit) -> list[TextRun]:
    if edit.runs:
        return [r for r in edit.runs if r.text]
    if not edit.new_text:
        return []
    return [
        TextRun(
            text=edit.new_text,
            font_family_override=edit.font_family_override,
            font_size_pt_override=edit.font_size_pt_override,
            color_hex_override=edit.color_hex_override,
            bold_override=edit.bold_override,
            italic_override=edit.italic_override,
            underline=edit.underline,
            strikethrough=edit.strikethrough,
            highlight_hex=edit.highlight_hex,
        )
    ]


def _render_scan_matched_runs(
    bg_patch: np.ndarray,
    runs: list[
        tuple[
            str,
            bytes,
            float,
            tuple[int, int, int],
            bool,
            bool,
            tuple[int, int, int] | None,
        ]
    ],
    draw_x_in_patch: int,
    max_width_px: int,
    origin_y_in_patch: float,
    blur_sigma: float,
    noise_std: float,
) -> np.ndarray:
    """Render one or more styled runs at 2x supersampling with scan-matched blur and noise."""
    if not runs:
        return bg_patch

    h, w, _ = bg_patch.shape
    scale = 2

    # Measure total width across all runs at 2x scale and shrink proportionally if overflowing.
    raw_fonts: list[tuple[ImageFont.FreeTypeFont, int]] = []
    total_w_1x = 0.0
    for text, font_buffer, font_size_px, _col, _ul, _st, _hl in runs:
        sz_2x = max(8, int(round(font_size_px * scale)))
        pf = ImageFont.truetype(io.BytesIO(font_buffer), size=sz_2x)
        raw_fonts.append((pf, sz_2x))
        total_w_1x += float(pf.getlength(text)) / scale

    available_w = max(1, min(max_width_px, w - draw_x_in_patch - 2))
    shrink = 1.0
    if total_w_1x > available_w and total_w_1x > 0:
        shrink = max(0.70, available_w / total_w_1x)

    prepared_runs: list[
        tuple[
            str,
            ImageFont.FreeTypeFont,
            int,
            float,
            tuple[int, int, int],
            bool,
            bool,
            tuple[int, int, int] | None,
        ]
    ] = []
    for (text, font_buffer, _fpx, col, ul, st, hl), (pf, sz_2x) in zip(
        runs, raw_fonts, strict=True
    ):
        if shrink < 1.0:
            sz_2x = max(8, int(round(sz_2x * shrink)))
            pf = ImageFont.truetype(io.BytesIO(font_buffer), size=sz_2x)
        run_w_1x = float(pf.getlength(text)) / scale
        prepared_runs.append((text, pf, sz_2x, run_w_1x, col, ul, st, hl))

    base_patch = bg_patch.astype(np.float32)
    baseline_2x = int(round(origin_y_in_patch * scale))

    # Pass 1: Blend per-run highlight strips onto cleaned paper background.
    cursor_x = float(draw_x_in_patch)
    for _text, _pf, sz_2x, run_w_1x, _col, _ul, _st, hl_rgb in prepared_runs:
        if hl_rgb is not None and run_w_1x > 0:
            eff_px = sz_2x / scale
            hx0 = max(0, int(round(cursor_x - 1)))
            hx1 = min(w, int(round(cursor_x + run_w_1x + 1)))
            hy0 = max(0, int(round(origin_y_in_patch - eff_px * 0.85)))
            hy1 = min(h, int(round(origin_y_in_patch + eff_px * 0.22)))
            if hx1 > hx0 and hy1 > hy0:
                hl = np.array(hl_rgb, dtype=np.float32)
                base_patch[hy0:hy1, hx0:hx1] = base_patch[hy0:hy1, hx0:hx1] * 0.35 + hl * 0.65
        cursor_x += run_w_1x

    # Pass 2: Composite each run with its own ink color, blur, and subtle grain.
    out = base_patch
    cursor_x = float(draw_x_in_patch)
    for (
        text,
        pil_font,
        sz_2x,
        run_w_1x,
        color_rgb_255,
        underline,
        strikethrough,
        _hl,
    ) in prepared_runs:
        alpha_2x = Image.new("L", (w * scale, h * scale), 0)
        draw = ImageDraw.Draw(alpha_2x)
        x0_2x = int(round(cursor_x * scale))
        x1_2x = int(round((cursor_x + run_w_1x) * scale))
        draw.text((x0_2x, baseline_2x), text, fill=255, font=pil_font, anchor="ls")

        stroke_w_2x = max(2, int(round(sz_2x * 0.065)))
        if underline and x1_2x > x0_2x:
            uy = baseline_2x + max(2, int(round(sz_2x * 0.14)))
            draw.line([(x0_2x, uy), (x1_2x, uy)], fill=255, width=stroke_w_2x)
        if strikethrough and x1_2x > x0_2x:
            sy = baseline_2x - max(2, int(round(sz_2x * 0.28)))
            draw.line([(x0_2x, sy), (x1_2x, sy)], fill=255, width=stroke_w_2x)

        alpha_1x = alpha_2x.resize((w, h), Image.Resampling.LANCZOS)
        if blur_sigma > 0.1:
            alpha_1x = alpha_1x.filter(ImageFilter.GaussianBlur(radius=blur_sigma))
        # Apply xerox toner contrast curve so stems stay rich/crisp rather than soft gray.
        raw_alpha = np.clip(np.asarray(alpha_1x, dtype=np.float32) / 255.0, 0.0, 1.0)
        alpha_f = np.power(raw_alpha, 0.78)[..., None]

        fg = np.full((h, w, 3), color_rgb_255, dtype=np.float32)
        if noise_std > 0.5:
            rng = np.random.default_rng(seed=hash(text) & 0xFFFFFFFF)
            grain = rng.normal(0.0, noise_std * 0.8, size=(h, w, 1)).astype(np.float32)
            fg = np.clip(fg + grain, 0.0, 255.0)

        out = out * (1.0 - alpha_f) + fg * alpha_f
        cursor_x += run_w_1x

    return np.clip(out, 0.0, 255.0).astype(np.uint8)


def _has_whole_line_style_override(edit: TextEdit) -> bool:
    if (
        edit.font_family_override
        or edit.font_size_pt_override is not None
        or edit.color_hex_override
        or edit.bold_override is not None
        or edit.italic_override is not None
        or edit.underline
        or edit.strikethrough
        or edit.highlight_hex
    ):
        return True
    if edit.runs:
        if len(edit.runs) > 1:
            return True
        r0 = edit.runs[0]
        if (
            r0.font_family_override
            or r0.font_size_pt_override is not None
            or r0.color_hex_override
            or r0.bold_override is not None
            or r0.italic_override is not None
            or r0.underline
            or r0.strikethrough
            or r0.highlight_hex
        ):
            return True
    return False


def _segment_word_intervals(mask: np.ndarray, expected_words: int) -> list[tuple[int, int]] | None:
    """Split a line ink mask into `expected_words` horizontal [x0, x1] word spans."""
    if expected_words <= 1 or mask.size == 0:
        return None
    col_has_ink = mask.any(axis=0)
    cols = np.where(col_has_ink)[0]
    if cols.size < 4:
        return None

    # Collect contiguous ink runs and the whitespace gaps between them.
    ink_runs: list[tuple[int, int]] = []
    start = int(cols[0])
    prev = start
    for c in cols[1:]:
        ci = int(c)
        if ci > prev + 1:
            ink_runs.append((start, prev + 1))
            start = ci
        prev = ci
    ink_runs.append((start, prev + 1))

    if len(ink_runs) < expected_words:
        return None

    # Merge smallest gaps until exactly `expected_words` intervals remain.
    gaps = [
        (ink_runs[i + 1][0] - ink_runs[i][1], i) for i in range(len(ink_runs) - 1)
    ]
    # Keep the (expected_words - 1) widest gaps as word boundaries.
    split_indices = sorted(
        idx for _gap_w, idx in sorted(gaps, key=lambda g: g[0], reverse=True)[: expected_words - 1]
    )
    # Reject split if any chosen word gap is tiny (<= 2 px), avoiding mid-letter cuts.
    min_chosen_gap = min(ink_runs[i + 1][0] - ink_runs[i][1] for i in split_indices)
    if min_chosen_gap < 3:
        return None

    words: list[tuple[int, int]] = []
    seg_start = 0
    for split_after in split_indices:
        words.append((ink_runs[seg_start][0], ink_runs[split_after][1]))
        seg_start = split_after + 1
    words.append((ink_runs[seg_start][0], ink_runs[-1][1]))
    return words


def _find_surgical_word_diff(
    orig_text: str,
    new_text: str,
    mask: np.ndarray,
) -> tuple[int, int, int, str, bool] | None:
    """If a contiguous word sub-span changed, return (x0, x1, max_w, replacement, at_end)."""
    orig_words = orig_text.split()
    new_words = new_text.split()
    if len(orig_words) < 2 or not new_words:
        return None

    pre = 0
    while pre < len(orig_words) and pre < len(new_words) and orig_words[pre] == new_words[pre]:
        pre += 1
    suf = 0
    while (
        suf < len(orig_words) - pre
        and suf < len(new_words) - pre
        and orig_words[len(orig_words) - 1 - suf] == new_words[len(new_words) - 1 - suf]
    ):
        suf += 1

    if pre == 0 and suf == 0:
        return None
    if pre + suf >= len(orig_words):
        return None

    intervals = _segment_word_intervals(mask, len(orig_words))
    if intervals is None:
        return None

    change_start = pre
    change_end = len(orig_words) - suf  # exclusive
    sub_x0 = intervals[change_start][0]
    sub_x1 = intervals[change_end - 1][1]
    replacement = " ".join(new_words[change_start : len(new_words) - suf])

    at_end = suf == 0
    if at_end:
        max_w = max(sub_x1 - sub_x0, 1)
    else:
        next_word_x0 = intervals[change_end][0]
        gap = max(2, next_word_x0 - sub_x1)
        max_w = max(sub_x1 - sub_x0, next_word_x0 - sub_x0 - max(2, gap // 3))

    return sub_x0, sub_x1, max_w, replacement, at_end


def _safe_right_boundary(
    block: TextBlock,
    all_blocks: list[TextBlock],
    bx0: int,
    bx1: int,
    w_px: int,
    px_per_pt_x: float,
    px_per_pt_y: float,
) -> int:
    """Find how far right a replacement string can safely extend without hitting another block."""
    by0 = block.bbox[1] * px_per_pt_y
    by1 = block.bbox[3] * px_per_pt_y
    right_margin = w_px - max(16, int(round(w_px * 0.03)))
    limit = max(bx1 + 12, right_margin)
    for other in all_blocks:
        if other.id == block.id or other.page_index != block.page_index:
            continue
        oy0 = other.bbox[1] * px_per_pt_y
        oy1 = other.bbox[3] * px_per_pt_y
        if oy1 <= by0 or oy0 >= by1:
            continue
        ox0 = int(math.floor(other.bbox[0] * px_per_pt_x))
        if ox0 >= bx1 - 4:
            limit = min(limit, max(bx1 + 6, ox0 - 6))
    return max(bx1 + 6, limit)


def apply_scanned_edits(
    doc: pymupdf.Document,
    page_index: int,
    blocks: list[TextBlock],
    edits: list[TextEdit],
    inpainter: Inpainter | None = None,
) -> None:
    """Inpaint edited text boxes on a scanned page and composite scan-matched replacement text."""
    if not edits:
        return

    block_map = {b.id: b for b in blocks if b.page_index == page_index and b.kind == "scanned"}
    active_pairs = [(block_map[e.block_id], e) for e in edits if e.block_id in block_map]
    if not active_pairs:
        return

    page = doc[page_index]
    rgb = extract_page_raster(page, dpi=SCAN_WORK_DPI)
    h_px, w_px, _ = rgb.shape
    px_per_pt_x = w_px / max(page.rect.width, 1.0)
    px_per_pt_y = h_px / max(page.rect.height, 1.0)

    engine = inpainter or OpenCVInpainter(radius=4)
    dilate_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))

    for block, edit in active_pairs:
        bx0 = max(0, int(math.floor(block.bbox[0] * px_per_pt_x)))
        by0 = max(0, int(math.floor(block.bbox[1] * px_per_pt_y)))
        bx1 = min(w_px, int(math.ceil(block.bbox[2] * px_per_pt_x)))
        by1 = min(h_px, int(math.ceil(block.bbox[3] * px_per_pt_y)))
        if bx1 - bx0 < 4 or by1 - by0 < 4:
            continue

        line_crop = rgb[by0:by1, bx0:bx1]
        line_ink = _compute_ink_mask(line_crop)
        line_pt_h = (by1 - by0) / max(px_per_pt_y, 1e-6)
        (
            cal_color,
            cal_size_pt,
            cal_family,
            cal_bold,
            _cal_italic,
            cal_serif,
            _cal_mono,
            cal_baseline_frac,
        ) = _estimate_ink_style(line_crop, line_pt_h, block.text)

        # Try surgical word-only replacement so untouched original xerox words stay pixel-exact.
        surgical = (
            None
            if _has_whole_line_style_override(edit)
            else _find_surgical_word_diff(block.text, edit.new_text, line_ink)
        )

        safe_right = _safe_right_boundary(
            block, blocks, bx0, bx1, w_px, px_per_pt_x, px_per_pt_y
        )

        if surgical is not None:
            rel_x0, rel_x1, slot_max_w, repl_text, at_end = surgical
            tx0 = bx0 + rel_x0
            tx1 = bx0 + rel_x1
            sub_crop = rgb[by0:by1, tx0:tx1]
            # Calibrate local weight & toner color directly from the changed word slice.
            if sub_crop.shape[1] >= 4:
                (
                    sub_color,
                    _sub_size,
                    _sub_fam,
                    sub_bold,
                    _,
                    _,
                    _,
                    _,
                ) = _estimate_ink_style(sub_crop, line_pt_h, repl_text or block.text)
                target_color = sub_color
                target_bold = sub_bold
            else:
                target_color = cal_color
                target_bold = cal_bold

            pad_x = 6
            pad_y = max(12, int(round((by1 - by0) * 0.25)))
            px0 = max(0, tx0 - pad_x)
            py0 = max(0, by0 - pad_y)
            px1 = safe_right if at_end else min(w_px, tx0 + slot_max_w + pad_x)
            px1 = max(px1, min(w_px, tx1 + pad_x))
            py1 = min(h_px, by1 + pad_y)

            patch = rgb[py0:py1, px0:px1].copy()
            lx0, ly0 = tx0 - px0, by0 - py0
            lx1, ly1 = tx1 - px0, by1 - py0

            orig_crop = patch[ly0:ly1, lx0:lx1]
            blur_sigma = _estimate_local_blur_sigma(orig_crop)
            mask = np.zeros(patch.shape[:2], dtype=np.uint8)
            ink = _compute_ink_mask(orig_crop)
            mask[ly0:ly1, lx0:lx1] = cv2.dilate(ink, dilate_kernel, iterations=1)
            cleaned_patch = engine.inpaint(patch, mask)

            if repl_text:
                noise_std = _estimate_local_paper_noise(cleaned_patch)
                resolved = resolve_font_for_edit(
                    doc,
                    font_xref=None,
                    original_font_name=cal_family,
                    replacement_text=repl_text,
                    bold=target_bold,
                    italic=block.style.italic,
                    serif=cal_serif,
                    mono=block.style.mono,
                    family_override=None,
                )
                r_f, g_f, b_f = hex_to_rgb_float(target_color)
                color_255 = (
                    int(round(r_f * 255)),
                    int(round(g_f * 255)),
                    int(round(b_f * 255)),
                )
                origin_y_in_patch = ly0 + (by1 - by0) * cal_baseline_frac
                render_max_w = (px1 - tx0 - 4) if at_end else slot_max_w
                cleaned_patch = _render_scan_matched_runs(
                    bg_patch=cleaned_patch,
                    runs=[
                        (
                            repl_text,
                            resolved.font_buffer,
                            cal_size_pt * px_per_pt_y,
                            color_255,
                            False,
                            False,
                            None,
                        )
                    ],
                    draw_x_in_patch=lx0,
                    max_width_px=max(8, render_max_w),
                    origin_y_in_patch=origin_y_in_patch,
                    blur_sigma=blur_sigma,
                    noise_std=noise_std,
                )
            rgb[py0:py1, px0:px1] = cleaned_patch
            continue

        pad_y = max(12, int(round((by1 - by0) * 0.25)))
        px0 = max(0, bx0 - 8)
        py0 = max(0, by0 - pad_y)
        px1 = safe_right
        py1 = min(h_px, by1 + pad_y)

        patch = rgb[py0:py1, px0:px1].copy()
        local_x0, local_y0 = bx0 - px0, by0 - py0
        local_x1, local_y1 = bx1 - px0, by1 - py0

        # Estimate blur from the original un-erased text crop before inpainting.
        orig_crop = patch[local_y0:local_y1, local_x0:local_x1]
        blur_sigma = _estimate_local_blur_sigma(orig_crop)

        # Build tight dilated ink mask only inside the original text box, never touching neighbors.
        mask = np.zeros(patch.shape[:2], dtype=np.uint8)
        ink = _compute_ink_mask(orig_crop)
        mask[local_y0:local_y1, local_x0:local_x1] = cv2.dilate(ink, dilate_kernel, iterations=1)

        cleaned_patch = engine.inpaint(patch, mask)

        eff_runs = _scanned_effective_runs(edit)
        if eff_runs:
            noise_std = _estimate_local_paper_noise(cleaned_patch)
            prepared_runs: list[
                tuple[
                    str,
                    bytes,
                    float,
                    tuple[int, int, int],
                    bool,
                    bool,
                    tuple[int, int, int] | None,
                ]
            ] = []
            for run in eff_runs:
                target_bold = (
                    run.bold_override
                    if run.bold_override is not None
                    else (
                        edit.bold_override if edit.bold_override is not None else cal_bold
                    )
                )
                target_italic = (
                    run.italic_override
                    if run.italic_override is not None
                    else (
                        edit.italic_override
                        if edit.italic_override is not None
                        else block.style.italic
                    )
                )
                resolved = resolve_font_for_edit(
                    doc,
                    font_xref=None,
                    original_font_name=cal_family,
                    replacement_text=run.text,
                    bold=target_bold,
                    italic=target_italic,
                    serif=cal_serif,
                    mono=block.style.mono,
                    family_override=run.font_family_override or edit.font_family_override,
                )
                font_size_pt = (
                    run.font_size_pt_override
                    if run.font_size_pt_override is not None
                    else (
                        edit.font_size_pt_override
                        if edit.font_size_pt_override is not None
                        else cal_size_pt
                    )
                )
                font_size_px = font_size_pt * px_per_pt_y

                r_f, g_f, b_f = hex_to_rgb_float(
                    run.color_hex_override or edit.color_hex_override or cal_color
                )
                color_255 = (
                    int(round(r_f * 255)),
                    int(round(g_f * 255)),
                    int(round(b_f * 255)),
                )

                highlight_255: tuple[int, int, int] | None = None
                hl_hex = run.highlight_hex or edit.highlight_hex
                if hl_hex:
                    hr, hg, hb = hex_to_rgb_float(hl_hex)
                    highlight_255 = (
                        int(round(hr * 255)),
                        int(round(hg * 255)),
                        int(round(hb * 255)),
                    )

                prepared_runs.append(
                    (
                        run.text,
                        resolved.font_buffer,
                        font_size_px,
                        color_255,
                        run.underline or edit.underline,
                        run.strikethrough or edit.strikethrough,
                        highlight_255,
                    )
                )

            origin_y_in_patch = local_y0 + (by1 - by0) * cal_baseline_frac
            cleaned_patch = _render_scan_matched_runs(
                bg_patch=cleaned_patch,
                runs=prepared_runs,
                draw_x_in_patch=local_x0,
                max_width_px=max(16, px1 - bx0 - 4),
                origin_y_in_patch=origin_y_in_patch,
                blur_sigma=blur_sigma,
                noise_std=noise_std,
            )

        rgb[py0:py1, px0:px1] = cleaned_patch

    # Replace the scanned page with the patched raster preserving original PDF page dimensions.
    buf = io.BytesIO()
    Image.fromarray(rgb).save(buf, format="PNG", optimize=False)
    rect = page.rect
    doc.delete_page(page_index)
    new_page = doc.new_page(pno=page_index, width=rect.width, height=rect.height)
    new_page.insert_image(rect, stream=buf.getvalue())
