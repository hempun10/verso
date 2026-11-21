"""Tests for Phase 1 native PDF core engine: classification, fonts, editing, and API."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pymupdf
from fastapi.testclient import TestClient

from editpdf.api import create_app
from editpdf.classifier import classify_page, inspect_document
from editpdf.fonts import font_buffer_supports_text, normalize_family_name, resolve_font_for_edit
from editpdf.models import TextEdit, TextRun
from editpdf.native_engine import apply_native_edits, extract_native_blocks
from editpdf.service import SessionStore


def _make_native_pdf(*, subset: bool = False, bg_rgb: tuple[float, float, float] | None = None):
    doc = pymupdf.open()
    page = doc.new_page(width=612, height=792)
    if bg_rgb is not None:
        page.draw_rect(page.rect, color=bg_rgb, fill=bg_rgb)

    font = pymupdf.Font("tiro")
    page.insert_font(fontname="F0", fontbuffer=font.buffer)
    page.insert_text(
        (72, 100), "Invoice Number 1042", fontname="F0", fontsize=16, color=(0.1, 0.1, 0.1)
    )
    page.insert_text(
        (72, 140), "Unchanged Footer Line", fontname="F0", fontsize=12, color=(0.2, 0.2, 0.2)
    )

    # Add rotated text at 90 degrees
    origin = pymupdf.Point(450, 300)
    page.insert_text(
        origin,
        "SIDE LABEL",
        fontname="F0",
        fontsize=12,
        color=(0.1, 0.2, 0.5),
        morph=(origin, pymupdf.Matrix(-90)),
    )

    if subset:
        doc.subset_fonts()

    raw = doc.tobytes()
    doc.close()
    return raw


def _make_mixed_pdf() -> bytes:
    """Page 0: native text. Page 1: rasterized scan image with no selectable text."""
    doc = pymupdf.open()
    p0 = doc.new_page(width=612, height=792)
    p0.insert_text((72, 100), "Native cover page with selectable text.", fontsize=14)

    # Render page 0 to a raster PNG and place it full-bleed on page 1.
    pix = p0.get_pixmap(dpi=120, alpha=False)
    p1 = doc.new_page(width=612, height=792)
    p1.insert_image(p1.rect, stream=pix.tobytes("png"))

    raw = doc.tobytes()
    doc.close()
    return raw


def _render_rgb(doc: pymupdf.Document, page_index: int, dpi: int = 120) -> np.ndarray:
    pix = doc[page_index].get_pixmap(dpi=dpi, alpha=False)
    arr = np.frombuffer(pix.samples, dtype=np.uint8)
    return arr.reshape(pix.height, pix.width, pix.n)[:, :, :3]


def test_classifier_handles_mixed_native_and_scanned_pages():
    raw = _make_mixed_pdf()
    with pymupdf.open(stream=raw, filetype="pdf") as doc:
        assert classify_page(doc[0]) == "native"
        assert classify_page(doc[1]) == "scanned"
        pages = inspect_document(doc)
        assert [p.kind for p in pages] == ["native", "scanned"]


def test_subsetted_cff_font_detects_missing_glyph_and_falls_back():
    raw = _make_native_pdf(subset=True)
    with pymupdf.open(stream=raw, filetype="pdf") as doc:
        blocks = extract_native_blocks(doc[0], 0)
        invoice_block = next(b for b in blocks if "Invoice" in b.text)
        assert invoice_block.font_xref is not None

        _n, _e, _t, buf = doc.extract_font(invoice_block.font_xref)
        assert isinstance(buf, bytes)
        # 'I', 'n', 'v' exist in the subsetted PDF; 'Z' and 'Q' were never used.
        assert font_buffer_supports_text(buf, "Invoice")
        assert not font_buffer_supports_text(buf, "Zebra Quilt")

        # Editing with existing glyphs reuses the exact embedded font.
        same_glyph_font = resolve_font_for_edit(
            doc,
            font_xref=invoice_block.font_xref,
            original_font_name=invoice_block.style.original_font_name,
            replacement_text="Invoice 4201",
            bold=invoice_block.style.bold,
            italic=invoice_block.style.italic,
            serif=invoice_block.style.serif,
            mono=invoice_block.style.mono,
        )
        assert same_glyph_font.source == "embedded"

        # Editing with missing glyphs cleanly falls back to a full font.
        fallback_font = resolve_font_for_edit(
            doc,
            font_xref=invoice_block.font_xref,
            original_font_name=invoice_block.style.original_font_name,
            replacement_text="Zebra Quote 9999",
            bold=invoice_block.style.bold,
            italic=invoice_block.style.italic,
            serif=invoice_block.style.serif,
            mono=invoice_block.style.mono,
        )
        assert fallback_font.source in ("system", "builtin")
        assert fallback_font.display_family == "times"
        assert font_buffer_supports_text(fallback_font.font_buffer, "Zebra Quote 9999")


def test_native_edit_preserves_untouched_regions_and_sampled_background():
    cream_bg = (0.96, 0.94, 0.88)
    raw = _make_native_pdf(subset=True, bg_rgb=cream_bg)

    with pymupdf.open(stream=raw, filetype="pdf") as orig_doc:
        before_rgb = _render_rgb(orig_doc, 0, dpi=120)
        blocks = extract_native_blocks(orig_doc[0], 0)

    invoice_block = next(b for b in blocks if "Invoice" in b.text)

    with pymupdf.open(stream=raw, filetype="pdf") as edit_doc:
        apply_native_edits(
            edit_doc,
            0,
            blocks,
            [TextEdit(block_id=invoice_block.id, new_text="Zebra Bill 8888")],
        )
        edited_bytes = edit_doc.tobytes(garbage=3, deflate=True)

    with pymupdf.open(stream=edited_bytes, filetype="pdf") as out_doc:
        extracted_text = str(out_doc[0].get_text()).replace("\u00a0", " ")
        assert "Zebra Bill 8888" in extracted_text
        assert "Invoice Number 1042" not in extracted_text
        assert "Unchanged Footer Line" in extracted_text

        after_rgb = _render_rgb(out_doc, 0, dpi=120)

    # Bottom half of the page (where footer + blank cream background live) must be 100% identical.
    mid_y = before_rgb.shape[0] // 2
    assert np.array_equal(before_rgb[mid_y:, :, :], after_rgb[mid_y:, :, :])

    # Background inside the redacted area (just above the edited text baseline) must stay cream,
    # not bright pure white (255, 255, 255).
    sample_patch = after_rgb[135:142, 120:160, :]
    mean_rgb = sample_patch.mean(axis=(0, 1))
    assert mean_rgb[0] > 235 and mean_rgb[2] < 235


def test_rotated_text_preserved_after_edit():
    raw = _make_native_pdf(subset=False)
    with pymupdf.open(stream=raw, filetype="pdf") as doc:
        blocks = extract_native_blocks(doc[0], 0)
        rotated = next(b for b in blocks if "SIDE" in b.text)
        assert abs(abs(rotated.angle_deg) - 90.0) < 1.0

        apply_native_edits(
            doc,
            0,
            blocks,
            [TextEdit(block_id=rotated.id, new_text="NEW TAG")],
        )
        out_bytes = doc.tobytes()

    with pymupdf.open(stream=out_bytes, filetype="pdf") as out_doc:
        out_blocks = extract_native_blocks(out_doc[0], 0)
        new_rotated = next(b for b in out_blocks if "NEW TAG" in b.text)
        assert abs(abs(new_rotated.angle_deg) - 90.0) < 1.0


def test_normalize_family_name_variants():
    assert normalize_family_name("ABCDEE+TimesNewRomanPS-BoldMT") == "times"
    assert normalize_family_name("XYZABC+Helvetica-Oblique") == "helvetica"
    assert normalize_family_name("NimbusMono-Regular") == "courier"
    assert normalize_family_name("QWERTS+Georgia-Italic") == "georgia"


def test_api_upload_blocks_preview_and_export(tmp_path: Path):
    store = SessionStore(root_dir=tmp_path)
    client = TestClient(create_app(store=store))

    pdf_bytes = _make_native_pdf(subset=True)
    res = client.post(
        "/api/documents",
        files={"file": ("sample.pdf", pdf_bytes, "application/pdf")},
    )
    assert res.status_code == 200
    summary = res.json()
    doc_id = summary["doc_id"]
    assert summary["page_count"] == 1
    assert summary["pages"][0]["kind"] == "native"

    blocks_res = client.get(f"/api/documents/{doc_id}/pages/0/blocks")
    assert blocks_res.status_code == 200
    blocks = blocks_res.json()
    target = next(b for b in blocks if "Invoice" in b["text"])

    preview_res = client.post(
        f"/api/documents/{doc_id}/preview",
        json={
            "page_index": 0,
            "edits": [{"block_id": target["id"], "new_text": "Receipt Z99"}],
        },
    )
    assert preview_res.status_code == 200
    assert preview_res.headers["content-type"] == "image/png"
    assert preview_res.content.startswith(b"\x89PNG")

    export_res = client.post(
        f"/api/documents/{doc_id}/export",
        json={"edits": [{"block_id": target["id"], "new_text": "Receipt Z99"}]},
    )
    assert export_res.status_code == 200
    assert export_res.headers["content-type"] == "application/pdf"
    with pymupdf.open(stream=export_res.content, filetype="pdf") as exported:
        assert "Receipt Z99" in str(exported[0].get_text()).replace("\u00a0", " ")


def test_native_formatting_bold_italic_underline_strike_highlight():
    raw = _make_native_pdf(subset=False)
    with pymupdf.open(stream=raw, filetype="pdf") as doc:
        blocks = extract_native_blocks(doc[0], 0)
        target = next(b for b in blocks if "Invoice" in b.text)
        assert not target.style.bold
        assert not target.style.italic

        apply_native_edits(
            doc,
            0,
            blocks,
            [
                TextEdit(
                    block_id=target.id,
                    new_text="Invoice Bold Italic",
                    bold_override=True,
                    italic_override=True,
                    underline=True,
                    strikethrough=True,
                    highlight_hex="#fff3a3",
                )
            ],
        )
        out_bytes = doc.tobytes()

    with pymupdf.open(stream=out_bytes, filetype="pdf") as out_doc:
        out_blocks = extract_native_blocks(out_doc[0], 0)
        edited = next(b for b in out_blocks if "Invoice Bold Italic" in b.text)
        assert edited.style.bold
        assert edited.style.italic
        # Highlight rect + underline + strikethrough produce vector drawings on the page.
        drawings = out_doc[0].get_drawings()
        assert len(drawings) >= 3


def test_native_partial_run_formatting_applies_only_to_selected_words():
    raw = _make_native_pdf(subset=False)
    with pymupdf.open(stream=raw, filetype="pdf") as doc:
        blocks = extract_native_blocks(doc[0], 0)
        target = next(b for b in blocks if "Invoice" in b.text)

        apply_native_edits(
            doc,
            0,
            blocks,
            [
                TextEdit(
                    block_id=target.id,
                    new_text="Hello World",
                    runs=[
                        TextRun(text="Hello", bold_override=True, color_hex_override="#dc2626"),
                        TextRun(text=" World", bold_override=False),
                    ],
                )
            ],
        )
        out_bytes = doc.tobytes()

    with pymupdf.open(stream=out_bytes, filetype="pdf") as out_doc:
        out_blocks = extract_native_blocks(out_doc[0], 0)
        hello = next(b for b in out_blocks if "Hello" in b.text)
        world = next(b for b in out_blocks if "World" in b.text)
        assert hello.id != world.id
        assert hello.style.bold is True
        assert hello.style.color_hex.lower() == "#dc2626"
        assert world.style.bold is False
        assert world.bbox[0] >= hello.bbox[2] - 1.0


def test_api_rejects_non_pdf_upload(tmp_path: Path):
    store = SessionStore(root_dir=tmp_path)
    client = TestClient(create_app(store=store))
    res = client.post(
        "/api/documents",
        files={"file": ("fake.pdf", b"not a pdf at all", "application/pdf")},
    )
    assert res.status_code == 400
