"""Native PDF text extraction and font-preserving non-destructive editing."""

from __future__ import annotations

import math
import re

import numpy as np
import pymupdf

from editpdf.fonts import (
    ResolvedFont,
    normalize_family_name,
    resolve_font_for_edit,
    strip_subset_prefix,
)
from editpdf.models import FontSource, TextBlock, TextEdit, TextRun, TextStyle

# PyMuPDF span flag bitmasks
FLAG_ITALIC = 1 << 1
FLAG_SERIF = 1 << 2
FLAG_MONO = 1 << 3
FLAG_BOLD = 1 << 4

HEX_COLOR_RE = re.compile(r"^#?([0-9a-fA-F]{6})$")


def int_color_to_hex(color_int: int) -> str:
    r = (color_int >> 16) & 0xFF
    g = (color_int >> 8) & 0xFF
    b = color_int & 0xFF
    return f"#{r:02x}{g:02x}{b:02x}"


def hex_to_rgb_float(color_hex: str) -> tuple[float, float, float]:
    match = HEX_COLOR_RE.match(color_hex.strip())
    if not match:
        return (0.0, 0.0, 0.0)
    raw = match.group(1)
    return (
        int(raw[0:2], 16) / 255.0,
        int(raw[2:4], 16) / 255.0,
        int(raw[4:6], 16) / 255.0,
    )


def _build_font_xref_lookup(page: pymupdf.Page) -> dict[str, int]:
    """Map normalized PDF font names present on a page to their embedded xref."""
    lookup: dict[str, int] = {}
    for font_tuple in page.get_fonts(full=True):
        xref = int(font_tuple[0])
        raw_name = str(font_tuple[3] or "")
        if not raw_name:
            continue
        stripped = strip_subset_prefix(raw_name)
        for key in (
            raw_name,
            raw_name.lower(),
            stripped,
            stripped.lower(),
            stripped.replace(" ", "").lower(),
            stripped.replace("-", "").replace(" ", "").lower(),
        ):
            lookup.setdefault(key, xref)
    return lookup


def _lookup_font_xref(lookup: dict[str, int], span_font: str) -> int | None:
    stripped = strip_subset_prefix(span_font)
    for key in (
        span_font,
        span_font.lower(),
        stripped,
        stripped.lower(),
        stripped.replace(" ", "").lower(),
        stripped.replace("-", "").replace(" ", "").lower(),
    ):
        if key in lookup:
            return lookup[key]
    return None


def _style_flags_from_span(font_name: str, flags: int) -> tuple[bool, bool, bool, bool]:
    lower = font_name.lower()
    bold = bool(flags & FLAG_BOLD) or any(
        tok in lower for tok in ("bold", "black", "heavy", "semibold", "demi")
    )
    italic = bool(flags & FLAG_ITALIC) or any(
        tok in lower for tok in ("italic", "oblique", "slant")
    )
    mono = bool(flags & FLAG_MONO) or any(
        tok in lower for tok in ("courier", "mono", "consolas", "menlo", "code")
    )
    serif = bool(flags & FLAG_SERIF) or any(
        tok in lower for tok in ("times", "roman", "serif", "georgia", "garamond", "cambria")
    )
    return bold, italic, serif, mono


def extract_native_blocks(page: pymupdf.Page, page_index: int) -> list[TextBlock]:
    """Extract editable text blocks from a native PDF page.

    Adjacent spans on the same line with identical style and small horizontal gap
    are merged so users click whole phrases instead of fragmented kerning runs.
    """
    font_lookup = _build_font_xref_lookup(page)
    text_dict = page.get_text("dict", flags=pymupdf.TEXTFLAGS_DICT & ~pymupdf.TEXT_PRESERVE_IMAGES)
    assert isinstance(text_dict, dict)
    blocks: list[TextBlock] = []
    counter = 0

    for raw_block in text_dict.get("blocks", []):
        if raw_block.get("type") != 0:
            continue
        for line in raw_block.get("lines", []):
            dir_x, dir_y = line.get("dir", (1.0, 0.0))
            angle_deg = round(math.degrees(math.atan2(-dir_y, dir_x)), 2)

            merged_spans: list[dict] = []
            for span in line.get("spans", []):
                text = span.get("text", "")
                if not text or not text.strip():
                    continue

                if merged_spans and _can_merge_spans(merged_spans[-1], span, angle_deg):
                    prev = merged_spans[-1]
                    prev["text"] += text
                    px0, py0, px1, py1 = prev["bbox"]
                    sx0, sy0, sx1, sy1 = span["bbox"]
                    prev["bbox"] = (min(px0, sx0), min(py0, sy0), max(px1, sx1), max(py1, sy1))
                else:
                    merged_spans.append(
                        {
                            "text": text,
                            "bbox": tuple(float(v) for v in span["bbox"]),
                            "origin": tuple(float(v) for v in span["origin"]),
                            "font": str(span["font"]),
                            "size": float(span["size"]),
                            "color": int(span["color"]),
                            "flags": int(span["flags"]),
                        }
                    )

            for item in merged_spans:
                # Normalize non-breaking spaces that TrueType fonts often map onto space glyphs.
                normalized_text = item["text"].replace("\u00a0", " ")
                raw_font = item["font"]
                bold, italic, serif, mono = _style_flags_from_span(raw_font, item["flags"])
                xref = _lookup_font_xref(font_lookup, raw_font)
                source: FontSource = "embedded" if xref is not None else "builtin"

                blocks.append(
                    TextBlock(
                        id=f"p{page_index}_n{counter}",
                        page_index=page_index,
                        kind="native",
                        text=normalized_text,
                        bbox=item["bbox"],
                        origin=item["origin"],
                        angle_deg=angle_deg,
                        font_xref=xref,
                        style=TextStyle(
                            font_family=normalize_family_name(raw_font),
                            original_font_name=raw_font,
                            font_source=source,
                            font_size_pt=round(item["size"], 2),
                            color_hex=int_color_to_hex(item["color"]),
                            bold=bold,
                            italic=italic,
                            serif=serif,
                            mono=mono,
                            confidence=1.0,
                        ),
                    )
                )
                counter += 1

    return blocks


def _can_merge_spans(prev: dict, curr: dict, angle_deg: float) -> bool:
    # Keep rotated spans separate unless strictly horizontal; safer for origin preservation.
    if abs(angle_deg) > 1.0:
        return False
    if (
        prev["font"] != curr["font"]
        or abs(prev["size"] - float(curr["size"])) > 0.25
        or prev["color"] != int(curr["color"])
        or prev["flags"] != int(curr["flags"])
    ):
        return False

    gap = float(curr["bbox"][0]) - prev["bbox"][2]
    # Merge within ~1.2x font size horizontal spacing (normal word space is ~0.25-0.35em).
    return -2.0 <= gap <= prev["size"] * 1.2


def sample_background_rgb(
    page_rgb: np.ndarray,
    page_rect: pymupdf.Rect,
    bbox: tuple[float, float, float, float],
) -> tuple[float, float, float]:
    """Sample median RGB from a 2px ring just outside `bbox` on the rendered page.

    Prevents ugly pure-white patches on cream, gray, or tinted table rows.
    """
    h, w, _ = page_rgb.shape
    sx = w / max(page_rect.width, 1.0)
    sy = h / max(page_rect.height, 1.0)

    x0 = max(0, int(math.floor(bbox[0] * sx)))
    y0 = max(0, int(math.floor(bbox[1] * sy)))
    x1 = min(w - 1, int(math.ceil(bbox[2] * sx)))
    y1 = min(h - 1, int(math.ceil(bbox[3] * sy)))

    pad = 3
    ox0 = max(0, x0 - pad)
    oy0 = max(0, y0 - pad)
    ox1 = min(w - 1, x1 + pad)
    oy1 = min(h - 1, y1 + pad)

    samples: list[np.ndarray] = []
    if oy0 < y0:
        samples.append(page_rgb[oy0:y0, ox0 : ox1 + 1].reshape(-1, 3))
    if y1 + 1 <= oy1:
        samples.append(page_rgb[y1 + 1 : oy1 + 1, ox0 : ox1 + 1].reshape(-1, 3))
    if ox0 < x0:
        samples.append(page_rgb[y0 : y1 + 1, ox0:x0].reshape(-1, 3))
    if x1 + 1 <= ox1:
        samples.append(page_rgb[y0 : y1 + 1, x1 + 1 : ox1 + 1].reshape(-1, 3))

    if not samples:
        return (1.0, 1.0, 1.0)

    border = np.concatenate(samples, axis=0)
    if border.size == 0:
        return (1.0, 1.0, 1.0)

    median = np.median(border, axis=0)
    return (float(median[0]) / 255.0, float(median[1]) / 255.0, float(median[2]) / 255.0)


def _render_page_rgb(page: pymupdf.Page, dpi: int = 150) -> np.ndarray:
    pix = page.get_pixmap(dpi=dpi, alpha=False)
    arr = np.frombuffer(pix.samples, dtype=np.uint8)
    return arr.reshape(pix.height, pix.width, pix.n)[:, :, :3]


def _fit_font_size(
    font: pymupdf.Font,
    text: str,
    target_size: float,
    max_width: float,
    min_scale: float = 0.80,
) -> float:
    """Slightly shrink font size only when replacement text overflows the original span width."""
    if not text or max_width <= 0:
        return target_size
    measured = font.text_length(text, fontsize=target_size)  # type: ignore[arg-type]
    # Allow up to 12% natural overhang before shrinking so short edits keep exact size.
    if measured <= max_width * 1.12:
        return target_size
    ratio = (max_width * 1.12) / measured
    clamped = max(ratio, min_scale)
    return round(target_size * clamped, 2)


def _rotation_matrix(angle_deg: float) -> pymupdf.Matrix | None:
    if abs(angle_deg) < 0.5:
        return None
    # PyMuPDF morph rotation is counter-clockwise in screen coords when angle is negated.
    return pymupdf.Matrix(-angle_deg)


def _effective_runs(edit: TextEdit) -> list[TextRun]:
    """Return the styled text runs to render for an edit (falling back to whole-block text)."""
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


def apply_native_edits(
    doc: pymupdf.Document,
    page_index: int,
    blocks: list[TextBlock],
    edits: list[TextEdit],
) -> None:
    """Apply edits in place to a single native PDF page.

    1. Sample the real background color behind every edited block before mutating the page.
    2. Redact only the edited bounding boxes using PDF_REDACT_IMAGE_NONE so underlying
       watermarks/backgrounds remain intact.
    3. Re-insert each edited string (or styled runs) at its original baseline origin using
       the resolved font (embedded if glyph-complete, otherwise matched system/builtin font).
    """
    if not edits:
        return

    block_map = {b.id: b for b in blocks if b.page_index == page_index and b.kind == "native"}
    active_pairs = [
        (block_map[e.block_id], e) for e in edits if e.block_id in block_map
    ]
    if not active_pairs:
        return

    page = doc[page_index]
    page_rgb = _render_page_rgb(page, dpi=150)

    # Phase 1: Resolve fonts for every run and sample backgrounds BEFORE redacting
    # (redacting can drop unused font streams if the redacted span was the last user).
    prepared: list[
        tuple[TextBlock, TextEdit, list[tuple[TextRun, ResolvedFont]], tuple[float, float, float]]
    ] = []
    for block, edit in active_pairs:
        bg_rgb = sample_background_rgb(page_rgb, page.rect, block.bbox)
        resolved_runs: list[tuple[TextRun, ResolvedFont]] = []
        for run in _effective_runs(edit):
            target_bold = (
                run.bold_override
                if run.bold_override is not None
                else (edit.bold_override if edit.bold_override is not None else block.style.bold)
            )
            target_italic = (
                run.italic_override
                if run.italic_override is not None
                else (
                    edit.italic_override if edit.italic_override is not None else block.style.italic
                )
            )
            family_override = run.font_family_override or edit.font_family_override
            style_changed = target_bold != block.style.bold or target_italic != block.style.italic
            resolved = resolve_font_for_edit(
                doc,
                font_xref=block.font_xref,
                original_font_name=block.style.original_font_name,
                replacement_text=run.text,
                bold=target_bold,
                italic=target_italic,
                serif=block.style.serif,
                mono=block.style.mono,
                family_override=family_override,
                allow_embedded=not style_changed,
            )
            resolved_runs.append((run, resolved))
        prepared.append((block, edit, resolved_runs, bg_rgb))

    # Phase 2: Redact only the edited spans.
    for block, _edit, _resolved_runs, bg_rgb in prepared:
        rect = pymupdf.Rect(block.bbox)
        # Keep tight bbox with 0.3pt margin so anti-aliased stems are fully cleared.
        redact_rect = pymupdf.Rect(
            rect.x0 - 0.3,
            rect.y0 - 0.3,
            rect.x1 + 0.3,
            rect.y1 + 0.3,
        )
        page.add_redact_annot(redact_rect, fill=bg_rgb)

    page.apply_redactions(
        images=pymupdf.PDF_REDACT_IMAGE_NONE,
        graphics=pymupdf.PDF_REDACT_LINE_ART_NONE,
    )

    # Phase 3: Register resolved fonts and draw replacement runs sequentially along baseline.
    inserted_fonts: set[str] = set()
    for block, edit, resolved_runs, _bg_rgb in prepared:
        if not resolved_runs:
            continue

        # Prepare per-run metrics & target sizes.
        run_specs: list[tuple[TextRun, ResolvedFont, pymupdf.Font, float]] = []
        has_explicit_size = edit.font_size_pt_override is not None
        for run, resolved in resolved_runs:
            if resolved.font_key not in inserted_fonts:
                page.insert_font(fontname=resolved.font_key, fontbuffer=resolved.font_buffer)
                inserted_fonts.add(resolved.font_key)
            if run.font_size_pt_override is not None:
                has_explicit_size = True
            target_size = (
                run.font_size_pt_override
                if run.font_size_pt_override is not None
                else (
                    edit.font_size_pt_override
                    if edit.font_size_pt_override is not None
                    else block.style.font_size_pt
                )
            )
            measure_font = pymupdf.Font(fontbuffer=resolved.font_buffer)
            run_specs.append((run, resolved, measure_font, target_size))

        # Auto-fit proportionally across the line when user did not explicitly override size.
        fit_scale = 1.0
        if not has_explicit_size and abs(block.angle_deg) < 1.0:
            orig_width = block.bbox[2] - block.bbox[0]
            if len(run_specs) == 1:
                r0, _res0, mfont0, sz0 = run_specs[0]
                fitted = _fit_font_size(mfont0, r0.text, sz0, orig_width)
                fit_scale = fitted / sz0 if sz0 > 0 else 1.0
            elif orig_width > 0:
                total_w = sum(
                    float(mf.text_length(r.text, fontsize=sz))  # type: ignore[arg-type]
                    for r, _res, mf, sz in run_specs
                )
                if total_w > orig_width * 1.12:
                    fit_scale = max(0.80, (orig_width * 1.12) / total_w)

        rot = _rotation_matrix(block.angle_deg)
        rad = math.radians(block.angle_deg)
        ux, uy = math.cos(rad), -math.sin(rad)
        nx, ny = -uy, ux

        cx, cy = block.origin[0], block.origin[1]
        for run, resolved, measure_font, target_size in run_specs:
            fontsize = round(target_size * fit_scale, 2) if fit_scale < 1.0 else target_size
            run_width = float(measure_font.text_length(run.text, fontsize=fontsize))  # type: ignore[arg-type]
            color_rgb = hex_to_rgb_float(
                run.color_hex_override or edit.color_hex_override or block.style.color_hex
            )
            origin = pymupdf.Point(cx, cy)

            hl_hex = run.highlight_hex or edit.highlight_hex
            if hl_hex and abs(block.angle_deg) < 1.0 and run_width > 0:
                hl_rgb = hex_to_rgb_float(hl_hex)
                hl_rect = pymupdf.Rect(
                    origin.x - 0.5,
                    origin.y - fontsize * 0.85,
                    origin.x + run_width + 0.5,
                    origin.y + fontsize * 0.24,
                )
                page.draw_rect(hl_rect, color=None, fill=hl_rgb)

            if rot is not None:
                page.insert_text(
                    origin,
                    run.text,
                    fontname=resolved.font_key,
                    fontsize=fontsize,
                    color=color_rgb,
                    morph=(origin, rot),
                )
            else:
                page.insert_text(
                    origin,
                    run.text,
                    fontname=resolved.font_key,
                    fontsize=fontsize,
                    color=color_rgb,
                )

            if (run.underline or run.strikethrough) and run_width > 0:
                stroke_w = max(0.6, fontsize * 0.065)
                if run.underline:
                    dy = fontsize * 0.14
                    p1 = pymupdf.Point(origin.x + nx * dy, origin.y + ny * dy)
                    p2 = pymupdf.Point(p1.x + ux * run_width, p1.y + uy * run_width)
                    page.draw_line(p1, p2, color=color_rgb, width=stroke_w)
                if run.strikethrough:
                    dy = -fontsize * 0.28
                    p1 = pymupdf.Point(origin.x + nx * dy, origin.y + ny * dy)
                    p2 = pymupdf.Point(p1.x + ux * run_width, p1.y + uy * run_width)
                    page.draw_line(p1, p2, color=color_rgb, width=stroke_w)

            cx += ux * run_width
            cy += uy * run_width
