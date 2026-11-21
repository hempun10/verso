"""Per-page classification separating native text PDFs from scanned image pages."""

from __future__ import annotations

import pymupdf

from editpdf.models import PageInfo, PageKind

# Minimum non-whitespace characters required to consider a page native text.
MIN_NATIVE_CHARS = 8
# If an image covers this much of the page and there is almost no text, it's a scan.
SCAN_IMAGE_COVERAGE_THRESHOLD = 0.70


def classify_page(page: pymupdf.Page) -> PageKind:
    """Classify a single PDF page as native text or scanned raster."""
    text = page.get_text("text")
    non_ws_chars = sum(1 for ch in text if not ch.isspace())
    if non_ws_chars >= MIN_NATIVE_CHARS:
        return "native"

    page_area = max(page.rect.width * page.rect.height, 1.0)
    image_coverage = 0.0
    for img in page.get_images(full=True):
        xref = img[0]
        for rect in page.get_image_rects(xref):
            clipped = rect & page.rect
            image_coverage += clipped.width * clipped.height / page_area

    if image_coverage >= SCAN_IMAGE_COVERAGE_THRESHOLD:
        return "scanned"

    # Sparse non-empty vector page (e.g. short title/form header) stays native.
    if non_ws_chars > 0:
        return "native"
    return "scanned" if page.get_images(full=True) else "native"


def inspect_document(doc: pymupdf.Document) -> list[PageInfo]:
    """Return page dimensions and native/scanned kind for every page."""
    pages: list[PageInfo] = []
    for idx in range(len(doc)):
        page = doc[idx]
        pages.append(
            PageInfo(
                page_index=idx,
                kind=classify_page(page),
                width_pt=float(page.rect.width),
                height_pt=float(page.rect.height),
            )
        )
    return pages
