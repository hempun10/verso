"""Font extraction, real glyph-outline coverage verification, and fallback resolution."""

from __future__ import annotations

import io
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Literal

import pymupdf
from fontTools.agl import UV2AGL
from fontTools.cffLib import CFFFontSet
from fontTools.ttLib import TTFont

from editpdf.models import FontSource

SUBSET_PREFIX_RE = re.compile(r"^[A-Z]{6}\+")

# Common PDF PostScript font aliases -> canonical family key.
FAMILY_ALIASES: dict[str, str] = {
    "helvetica": "helvetica",
    "arial": "helvetica",
    "arialmt": "helvetica",
    "nimbus sans": "helvetica",
    "nimbussans": "helvetica",
    "liberation sans": "helvetica",
    "liberationsans": "helvetica",
    "calibri": "helvetica",
    "carlito": "helvetica",
    "times": "times",
    "times new roman": "times",
    "timesnewroman": "times",
    "timesnewromanpsmt": "times",
    "timesnewromanps": "times",
    "nimbus roman": "times",
    "nimbusroman": "times",
    "liberation serif": "times",
    "liberationserif": "times",
    "cambria": "times",
    "caladea": "times",
    "georgia": "georgia",
    "courier": "courier",
    "courier new": "courier",
    "couriernew": "courier",
    "couriernewpsmt": "courier",
    "nimbus mono": "courier",
    "nimbusmono": "courier",
    "liberation mono": "courier",
    "liberationmono": "courier",
    "menlo": "courier",
    "consolas": "courier",
    "verdana": "verdana",
    "tahoma": "tahoma",
    "garamond": "garamond",
    "palatino": "palatino",
    "trebuchet": "trebuchet",
    "inter": "helvetica",
    "roboto": "helvetica",
}

BUILTIN_MATRIX: dict[tuple[str, bool, bool], str] = {
    ("sans", False, False): "helv",
    ("sans", True, False): "hebo",
    ("sans", False, True): "heit",
    ("sans", True, True): "hebi",
    ("serif", False, False): "tiro",
    ("serif", True, False): "tibo",
    ("serif", False, True): "tiit",
    ("serif", True, True): "tibi",
    ("mono", False, False): "cour",
    ("mono", True, False): "cobo",
    ("mono", False, True): "coit",
    ("mono", True, True): "cobi",
}

SYSTEM_FONT_DIRS = (
    Path("/System/Library/Fonts"),
    Path("/System/Library/Fonts/Supplemental"),
    Path("/Library/Fonts"),
    Path("/usr/share/fonts"),
    Path("/usr/local/share/fonts"),
)

# Maps (canonical_family, bold, italic) -> candidate system filenames (ordered by preference).
SYSTEM_FONT_CANDIDATES: dict[tuple[str, bool, bool], tuple[str, ...]] = {
    ("georgia", False, False): ("Georgia.ttf",),
    ("georgia", True, False): ("Georgia Bold.ttf",),
    ("georgia", False, True): ("Georgia Italic.ttf",),
    ("georgia", True, True): ("Georgia Bold Italic.ttf",),
    ("helvetica", False, False): ("Arial.ttf", "LiberationSans-Regular.ttf", "DejaVuSans.ttf"),
    ("helvetica", True, False): (
        "Arial Bold.ttf",
        "LiberationSans-Bold.ttf",
        "DejaVuSans-Bold.ttf",
    ),
    ("helvetica", False, True): ("Arial Italic.ttf", "LiberationSans-Italic.ttf"),
    ("helvetica", True, True): ("Arial Bold Italic.ttf", "LiberationSans-BoldItalic.ttf"),
    ("times", False, False): (
        "Times New Roman.ttf",
        "LiberationSerif-Regular.ttf",
        "DejaVuSerif.ttf",
    ),
    ("times", True, False): ("Times New Roman Bold.ttf", "LiberationSerif-Bold.ttf"),
    ("times", False, True): ("Times New Roman Italic.ttf", "LiberationSerif-Italic.ttf"),
    ("times", True, True): ("Times New Roman Bold Italic.ttf", "LiberationSerif-BoldItalic.ttf"),
    ("courier", False, False): ("Courier New.ttf", "LiberationMono-Regular.ttf"),
    ("courier", True, False): ("Courier New Bold.ttf", "LiberationMono-Bold.ttf"),
    ("courier", False, True): ("Courier New Italic.ttf", "LiberationMono-Italic.ttf"),
    ("courier", True, True): ("Courier New Bold Italic.ttf", "LiberationMono-BoldItalic.ttf"),
    ("verdana", False, False): ("Verdana.ttf",),
    ("verdana", True, False): ("Verdana Bold.ttf",),
    ("verdana", False, True): ("Verdana Italic.ttf",),
    ("verdana", True, True): ("Verdana Bold Italic.ttf",),
    ("tahoma", False, False): ("Tahoma.ttf",),
    ("tahoma", True, False): ("Tahoma Bold.ttf",),
    ("trebuchet", False, False): ("Trebuchet MS.ttf",),
    ("trebuchet", True, False): ("Trebuchet MS Bold.ttf",),
    ("trebuchet", False, True): ("Trebuchet MS Italic.ttf",),
    ("trebuchet", True, True): ("Trebuchet MS Bold Italic.ttf",),
}


@dataclass(frozen=True)
class ResolvedFont:
    font_key: str
    display_family: str
    source: FontSource
    font_buffer: bytes
    builtin_name: str | None = None


def strip_subset_prefix(font_name: str) -> str:
    return SUBSET_PREFIX_RE.sub("", font_name).strip()


def normalize_family_name(font_name: str) -> str:
    """Normalize a raw PDF font name into a canonical family key."""
    cleaned = strip_subset_prefix(font_name)
    base = re.split(r"[-,]", cleaned)[0].strip()

    # Check alias table BEFORE stripping style words so "Times New Roman" / "Nimbus Roman"
    # keep "Roman" as part of the family name.
    raw_compact = re.sub(r"\s+", " ", base).strip().lower()
    if raw_compact in FAMILY_ALIASES:
        return FAMILY_ALIASES[raw_compact]
    raw_nospace = raw_compact.replace(" ", "")
    for alias, canonical in FAMILY_ALIASES.items():
        alias_ns = alias.replace(" ", "")
        if raw_nospace == alias_ns or raw_nospace.startswith(alias_ns):
            return canonical

    stripped = re.sub(
        r"\b(bold|italic|oblique|regular|roman|medium|light|semibold|black|book|mt|ps)\b",
        "",
        base,
        flags=re.IGNORECASE,
    )
    compact = re.sub(r"\s+", " ", stripped).strip().lower()
    if compact in FAMILY_ALIASES:
        return FAMILY_ALIASES[compact]

    nospace = compact.replace(" ", "")
    for alias, canonical in FAMILY_ALIASES.items():
        alias_ns = alias.replace(" ", "")
        if alias_ns == nospace or nospace.startswith(alias_ns):
            return canonical
    return compact or "helvetica"


def _generic_class(
    family: str, *, serif: bool, mono: bool
) -> Literal["sans", "serif", "mono"]:
    if mono or family == "courier":
        return "mono"
    if serif or family in {"times", "georgia", "garamond", "palatino"}:
        return "serif"
    return "sans"


def _is_cff_glyph_nonempty(charstring) -> bool:
    charstring.decompile()
    program = charstring.program
    # Subsetted CFF fonts stub unused glyphs to ['endchar'] or [width, 'endchar'].
    if not program:
        return False
    ops = [tok for tok in program if isinstance(tok, str)]
    return any(op != "endchar" for op in ops)


def font_buffer_supports_text(font_buffer: bytes, text: str) -> bool:
    """Verify every non-whitespace char in `text` maps to a real outline in `font_buffer`.

    PDF font subsets often strip `cmap` tables or leave empty stub charstrings (`['endchar']`)
    for unused glyphs. A naive `has_glyph()` check returns false positives on those stubs,
    so we inspect the actual TTF `glyf`/CFF charstring programs via fontTools.
    """
    if not font_buffer:
        return False

    chars = {ch for ch in text if not ch.isspace()}
    if not chars:
        return True

    # Case 1: TrueType / OpenType SFNT container
    if font_buffer[:4] in (b"\x00\x01\x00\x00", b"OTTO", b"true"):
        try:
            tt = TTFont(io.BytesIO(font_buffer), lazy=True)
            cmap = tt.getBestCmap()
            if not cmap:
                return False

            if "glyf" in tt:
                glyf = tt["glyf"]
                for ch in chars:
                    gname = cmap.get(ord(ch))
                    if not gname or gname == ".notdef" or gname not in glyf:
                        return False
                    glyph = glyf[gname]
                    if glyph.numberOfContours == 0:
                        return False
                return True

            if "CFF " in tt:
                cff_table = tt["CFF "].cff
                top = cff_table[cff_table.fontNames[0]]
                charstrings = top.CharStrings
                for ch in chars:
                    gname = cmap.get(ord(ch))
                    if not gname or gname == ".notdef" or gname not in charstrings:
                        return False
                    if not _is_cff_glyph_nonempty(charstrings[gname]):
                        return False
                return True
        except Exception:
            return False

    # Case 2: Raw CFF stream (PyMuPDF extracts Type0/CID Type1C subsets in raw CFF format)
    try:
        cff = CFFFontSet()
        cff.decompile(io.BytesIO(font_buffer), otFont=None)
        if not cff.fontNames:
            return False
        top = cff[cff.fontNames[0]]
        charstrings = top.CharStrings
        for ch in chars:
            gname = UV2AGL.get(ord(ch))
            if not gname or gname not in charstrings:
                return False
            if not _is_cff_glyph_nonempty(charstrings[gname]):
                return False
        return True
    except Exception:
        return False


@lru_cache(maxsize=64)
def _index_system_fonts() -> dict[str, Path]:
    found: dict[str, Path] = {}
    for root in SYSTEM_FONT_DIRS:
        if not root.exists():
            continue
        for path in root.rglob("*.ttf"):
            found.setdefault(path.name.lower(), path)
        for path in root.rglob("*.otf"):
            found.setdefault(path.name.lower(), path)
    return found


def _find_system_font(family: str, *, bold: bool, italic: bool) -> Path | None:
    index = _index_system_fonts()
    for b, it in ((bold, italic), (bold, False), (False, italic), (False, False)):
        candidates = SYSTEM_FONT_CANDIDATES.get((family, b, it), ())
        for filename in candidates:
            path = index.get(filename.lower())
            if path is not None:
                return path
    return None


def list_available_override_fonts() -> list[str]:
    """Return user-selectable font family keys supported for overrides."""
    return ["helvetica", "times", "courier", "georgia", "verdana", "tahoma", "trebuchet"]


def resolve_font_for_edit(
    doc: pymupdf.Document,
    *,
    font_xref: int | None,
    original_font_name: str,
    replacement_text: str,
    bold: bool,
    italic: bool,
    serif: bool,
    mono: bool,
    family_override: str | None = None,
    allow_embedded: bool = True,
) -> ResolvedFont:
    """Resolve the highest-fidelity font that covers every glyph in `replacement_text`.

    Ladder:
    1. Explicit user override (or bold/italic change) -> system font or builtin match.
    2. Embedded PDF font program (only if style unchanged and every char has a real outline).
    3. Installed system font matching the normalized family + bold/italic style.
    4. Builtin PyMuPDF metric-compatible Base14/Nimbus font by class + style.
    """
    target_family = (
        normalize_family_name(family_override)
        if family_override
        else normalize_family_name(original_font_name)
    )

    if allow_embedded and not family_override and font_xref:
        try:
            _name, _ext, _ftype, raw_buf = doc.extract_font(font_xref)
            if isinstance(raw_buf, bytes) and raw_buf and font_buffer_supports_text(
                raw_buf, replacement_text
            ):
                # Validate PyMuPDF can actually load this buffer before committing to it.
                pymupdf.Font(fontbuffer=raw_buf)
                return ResolvedFont(
                    font_key=f"emb_{font_xref}",
                    display_family=target_family,
                    source="embedded",
                    font_buffer=raw_buf,
                )
        except Exception:
            pass

    sys_path = _find_system_font(target_family, bold=bold, italic=italic)
    if sys_path is not None:
        buf = sys_path.read_bytes()
        if font_buffer_supports_text(buf, replacement_text):
            source: FontSource = "override" if family_override else "system"
            return ResolvedFont(
                font_key=f"sys_{target_family}_{int(bold)}{int(italic)}",
                display_family=target_family,
                source=source,
                font_buffer=buf,
            )

    generic = _generic_class(target_family, serif=serif, mono=mono)
    builtin_name = BUILTIN_MATRIX[(generic, bold, italic)]
    builtin_font = pymupdf.Font(builtin_name)
    source = "override" if family_override else "builtin"
    return ResolvedFont(
        font_key=f"bin_{builtin_name}",
        display_family=target_family,
        source=source,
        font_buffer=bytes(builtin_font.buffer),
        builtin_name=builtin_name,
    )
