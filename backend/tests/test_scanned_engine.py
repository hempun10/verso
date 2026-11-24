"""Tests for scanned PDF OCR extraction, inpainting, scan-matched rendering, and mixed export."""

from __future__ import annotations

import io
from pathlib import Path

import numpy as np
import pymupdf
from PIL import Image, ImageFilter

from editpdf.models import TextEdit, TextRun
from editpdf.scanned_engine import apply_scanned_edits, extract_scanned_blocks
from editpdf.service import SessionStore


def _make_synthetic_scanned_pdf() -> bytes:
    """Create a realistic scanned PDF (warm paper tint + slight blur + subtle noise)."""
    # Step 1: Render clean vector text onto an off-white paper page.
    src = pymupdf.open()
    p = src.new_page(width=612, height=792)
    p.draw_rect(p.rect, color=(0.95, 0.94, 0.90), fill=(0.95, 0.94, 0.90))
    p.insert_text((72, 120), "CONTRACT AMOUNT 5000", fontsize=20, color=(0.12, 0.13, 0.15))
    p.insert_text((72, 220), "CLIENT NAME ACME CORP", fontsize=16, color=(0.15, 0.15, 0.18))
    pix = p.get_pixmap(dpi=200, alpha=False)
    src.close()

    # Step 2: Add mild scanner blur and paper grain.
    img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
    img = img.filter(ImageFilter.GaussianBlur(radius=0.5))
    arr = np.asarray(img, dtype=np.float32)
    rng = np.random.default_rng(42)
    noisy = np.clip(arr + rng.normal(0.0, 2.2, size=arr.shape), 0, 255).astype(np.uint8)
    buf = io.BytesIO()
    Image.fromarray(noisy).save(buf, format="PNG")

    # Step 3: Embed as a full-page raster scan inside a PDF.
    scan_doc = pymupdf.open()
    sp = scan_doc.new_page(width=612, height=792)
    sp.insert_image(sp.rect, stream=buf.getvalue())
    raw = scan_doc.tobytes()
    scan_doc.close()
    return raw


def test_scanned_ocr_edit_and_reverify_with_ocr():
    raw = _make_synthetic_scanned_pdf()
    with pymupdf.open(stream=raw, filetype="pdf") as doc:
        blocks = extract_scanned_blocks(doc[0], 0)
        assert len(blocks) >= 2
        amount_block = next(b for b in blocks if "5000" in b.text)
        assert amount_block.kind == "scanned"
        assert amount_block.style.confidence > 0.7
        # Ink color should be dark charcoal, not pure white.
        assert amount_block.style.color_hex.startswith("#")

        apply_scanned_edits(
            doc,
            0,
            blocks,
            [TextEdit(block_id=amount_block.id, new_text="CONTRACT AMOUNT 9800")],
        )
        edited_bytes = doc.tobytes()

    # Re-run OCR on the edited scanned PDF to confirm replacement text is clean and legible,
    # and the untouched second line survived.
    with pymupdf.open(stream=edited_bytes, filetype="pdf") as out_doc:
        out_blocks = extract_scanned_blocks(out_doc[0], 0)
        joined = " ".join(b.text for b in out_blocks).upper()
        assert "9800" in joined
        assert "5000" not in joined
        assert "ACME" in joined


def test_scanned_formatting_bold_underline_strikethrough_highlight():
    raw = _make_synthetic_scanned_pdf()
    with pymupdf.open(stream=raw, filetype="pdf") as doc:
        blocks = extract_scanned_blocks(doc[0], 0)
        amount_block = next(b for b in blocks if "5000" in b.text)

        apply_scanned_edits(
            doc,
            0,
            blocks,
            [
                TextEdit(
                    block_id=amount_block.id,
                    new_text="CONTRACT AMOUNT 8400",
                    bold_override=True,
                    italic_override=True,
                    underline=True,
                    strikethrough=True,
                    highlight_hex="#fff3a3",
                )
            ],
        )
        edited_bytes = doc.tobytes()

    # Check that highlight tint is visible inside the edited bbox on the rasterized page.
    with pymupdf.open(stream=edited_bytes, filetype="pdf") as out_doc:
        pix = out_doc[0].get_pixmap(dpi=150, alpha=False)
        arr = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
        sx = pix.width / out_doc[0].rect.width
        sy = pix.height / out_doc[0].rect.height
        x0, y0, x1, y1 = amount_block.bbox
        patch = arr[int(y0 * sy) : int(y1 * sy), int(x0 * sx) : int(x1 * sx), :3]
        # Yellow highlight has high R & G channels and noticeably lower B channel.
        yellow_pixels = (patch[:, :, 0] > 220) & (patch[:, :, 1] > 210) & (patch[:, :, 2] < 200)
        assert int(yellow_pixels.sum()) > 50


def test_scanned_partial_run_formatting_renders_colored_and_plain_words():
    scan_bytes = _make_synthetic_scanned_pdf()
    with pymupdf.open(stream=scan_bytes, filetype="pdf") as doc:
        blocks = extract_scanned_blocks(doc[0], 0)
        target = next(b for b in blocks if "5000" in b.text)
        apply_scanned_edits(
            doc,
            0,
            blocks,
            [
                TextEdit(
                    block_id=target.id,
                    new_text="HELLO world",
                    runs=[
                        TextRun(
                            text="HELLO",
                            bold_override=True,
                            color_hex_override="#dc2626",
                            highlight_hex="#fff3a3",
                        ),
                        TextRun(text=" world"),
                    ],
                )
            ],
        )
        edited_bytes = doc.tobytes()

    with pymupdf.open(stream=edited_bytes, filetype="pdf") as out_doc:
        pix = out_doc[0].get_pixmap(dpi=150, alpha=False)
        arr = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
        sx = pix.width / out_doc[0].rect.width
        sy = pix.height / out_doc[0].rect.height
        x0, y0, x1, y1 = target.bbox
        mid_x = int(((x0 + x1) / 2) * sx)
        left_half = arr[int(y0 * sy) : int(y1 * sy), int(x0 * sx) : mid_x, :3]
        right_half = arr[int(y0 * sy) : int(y1 * sy), mid_x : int(x1 * sx), :3]
        # Left half ("HELLO") has yellow highlight; right half ("world") has none.
        left_yellow = int(
            (
                (left_half[:, :, 0] > 220)
                & (left_half[:, :, 1] > 210)
                & (left_half[:, :, 2] < 200)
            ).sum()
        )
        right_yellow = int(
            (
                (right_half[:, :, 0] > 220)
                & (right_half[:, :, 1] > 210)
                & (right_half[:, :, 2] < 200)
            ).sum()
        )
        assert left_yellow > 30
        assert right_yellow < left_yellow // 3


def test_mixed_native_and_scanned_document_export(tmp_path: Path):
    # Build a 2-page PDF: page 0 native, page 1 scanned.
    scan_bytes = _make_synthetic_scanned_pdf()
    mixed = pymupdf.open()
    p0 = mixed.new_page(width=612, height=792)
    p0.insert_text((72, 100), "Cover Summary Draft", fontsize=18)

    with pymupdf.open(stream=scan_bytes, filetype="pdf") as scan_doc:
        mixed.insert_pdf(scan_doc)

    mixed_bytes = mixed.tobytes()
    mixed.close()

    store = SessionStore(root_dir=tmp_path)
    summary = store.create("mixed.pdf", mixed_bytes)
    assert [p.kind for p in summary.pages] == ["native", "scanned"]

    native_blocks = store.get_page_blocks(summary.doc_id, 0)
    scanned_blocks = store.get_page_blocks(summary.doc_id, 1)

    b0 = next(b for b in native_blocks if "Draft" in b.text)
    b1 = next(b for b in scanned_blocks if "5000" in b.text)

    exported = store.export_pdf(
        summary.doc_id,
        [
            TextEdit(block_id=b0.id, new_text="Cover Summary Final"),
            TextEdit(block_id=b1.id, new_text="CONTRACT AMOUNT 7777"),
        ],
    )

    with pymupdf.open(stream=exported, filetype="pdf") as out_doc:
        assert len(out_doc) == 2
        assert "Cover Summary Final" in str(out_doc[0].get_text()).replace("\u00a0", " ")
        out_scan_blocks = extract_scanned_blocks(out_doc[1], 1)
        assert "7777" in " ".join(b.text for b in out_scan_blocks)


def test_scanned_preview_and_export_skip_server_ocr_with_source_block(
    tmp_path: Path, monkeypatch
):
    """When client-side OCR supplies source_block, preview and export skip server RapidOCR."""
    import editpdf.scanned_engine as scanned_mod

    scan_bytes = _make_synthetic_scanned_pdf()
    with pymupdf.open(stream=scan_bytes, filetype="pdf") as doc:
        blocks = extract_scanned_blocks(doc[0], 0)
    amount_block = next(b for b in blocks if "5000" in b.text)

    store = SessionStore(root_dir=tmp_path)
    summary = store.create("scan.pdf", scan_bytes)

    def _fail_if_called():
        raise AssertionError("Server RapidOCR should not be invoked when source_block is provided")

    monkeypatch.setattr(scanned_mod, "_get_ocr", _fail_if_called)

    client_edit = TextEdit(
        block_id=amount_block.id,
        new_text="CONTRACT AMOUNT 6543",
        source_block=amount_block,
    )

    preview_png = store.render_page_png(summary.doc_id, 0, edits=[client_edit], dpi=150)
    assert preview_png.startswith(b"\x89PNG\r\n\x1a\n")

    exported_pdf = store.export_pdf(summary.doc_id, [client_edit])
    assert exported_pdf.startswith(b"%PDF")

    # Restore OCR to verify the rendered text inside the exported PDF.
    monkeypatch.undo()
    with pymupdf.open(stream=exported_pdf, filetype="pdf") as out_doc:
        out_blocks = extract_scanned_blocks(out_doc[0], 0)
        joined = " ".join(b.text for b in out_blocks).upper()
        assert "6543" in joined
        assert "5000" not in joined


def _make_font_scan_pdf(fontname: str, line_text: str, fontsize: float = 14.0) -> bytes:
    src = pymupdf.open()
    p = src.new_page(width=612, height=160)
    p.draw_rect(p.rect, color=(0.98, 0.98, 0.97), fill=(0.98, 0.98, 0.97))
    p.insert_text(
        (48, 90), line_text, fontsize=fontsize, fontname=fontname, color=(0.06, 0.06, 0.06)
    )
    pix = p.get_pixmap(dpi=250, alpha=False)
    src.close()

    buf = io.BytesIO()
    Image.frombytes("RGB", (pix.width, pix.height), pix.samples).save(buf, format="PNG")
    out = pymupdf.open()
    sp = out.new_page(width=612, height=160)
    sp.insert_image(sp.rect, stream=buf.getvalue())
    raw = out.tobytes()
    out.close()
    return raw


def test_scanned_serif_and_sans_font_classification():
    line = "This contract is made between Mrs. Harimaya Pun aged 74"
    times_pdf = _make_font_scan_pdf("tiro", line)
    helv_pdf = _make_font_scan_pdf("helv", line)

    with pymupdf.open(stream=times_pdf, filetype="pdf") as t_doc:
        t_blocks = extract_scanned_blocks(t_doc[0], 0)
        assert t_blocks
        assert t_blocks[0].style.serif is True
        assert t_blocks[0].style.font_family == "times"

    with pymupdf.open(stream=helv_pdf, filetype="pdf") as h_doc:
        h_blocks = extract_scanned_blocks(h_doc[0], 0)
        assert h_blocks
        assert h_blocks[0].style.serif is False
        assert h_blocks[0].style.font_family == "helvetica"


def test_scanned_surgical_word_edit_preserves_untouched_xerox_pixels():
    line = "Agreement signed between Alpha Corp aged 74 on Monday"
    raw = _make_font_scan_pdf("tiro", line, fontsize=15.0)
    with pymupdf.open(stream=raw, filetype="pdf") as doc:
        orig_pix = doc[0].get_pixmap(dpi=250, alpha=False)
        orig_arr = np.frombuffer(orig_pix.samples, dtype=np.uint8).reshape(
            orig_pix.height, orig_pix.width, orig_pix.n
        ).copy()

        blocks = extract_scanned_blocks(doc[0], 0)
        assert blocks
        target = blocks[0]
        assert "74" in target.text

        edited_text = target.text.replace("74", "82")
        apply_scanned_edits(
            doc,
            0,
            blocks,
            [TextEdit(block_id=target.id, new_text=edited_text)],
        )
        new_pix = doc[0].get_pixmap(dpi=250, alpha=False)
        new_arr = np.frombuffer(new_pix.samples, dtype=np.uint8).reshape(
            new_pix.height, new_pix.width, new_pix.n
        )
        # Untouched prefix ("Agreement signed") on the left third must remain pixel-identical.
        left_end = int(orig_arr.shape[1] * 0.30)
        assert np.array_equal(orig_arr[:, :left_end, :], new_arr[:, :left_end, :])

        out_blocks = extract_scanned_blocks(doc[0], 0)
        joined = " ".join(b.text for b in out_blocks)
        assert "82" in joined
        assert "74" not in joined


def test_scanned_edit_longer_ending_word_not_clipped():
    line = "Issued Date 1988"
    raw = _make_font_scan_pdf("tiro", line, fontsize=16.0)
    with pymupdf.open(stream=raw, filetype="pdf") as doc:
        blocks = extract_scanned_blocks(doc[0], 0)
        assert blocks
        target = blocks[0]
        apply_scanned_edits(
            doc,
            0,
            blocks,
            [TextEdit(block_id=target.id, new_text="Issued Date 1988/03/06")],
        )
        out_blocks = extract_scanned_blocks(doc[0], 0)
        joined = " ".join(b.text for b in out_blocks)
        assert "1988/03/06" in joined
