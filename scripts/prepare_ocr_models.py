#!/usr/bin/env python3
"""Prepare browser-side PP-OCRv4 ONNX models, dictionary, and ONNX Runtime WASM assets.

Copies the exact PP-OCRv4 ONNX models bundled in `rapidocr-onnxruntime` and the single-threaded
SIMD WASM runtime from `frontend/node_modules/onnxruntime-web/dist/` into gitignored
`frontend/public/models/` so both local dev (`pnpm dev`) and Cloudflare Pages serve them on the
same origin with immutable Cache-Control headers.
"""

from __future__ import annotations

import hashlib
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OCR_OUT = ROOT / "frontend" / "public" / "models" / "ocr"
ORT_OUT = ROOT / "frontend" / "public" / "models" / "ort"
ORT_SRC = ROOT / "frontend" / "node_modules" / "onnxruntime-web" / "dist"

OCR_FILES = (
    "ch_PP-OCRv4_det_infer.onnx",
    "ch_PP-OCRv4_rec_infer.onnx",
    "ch_ppocr_mobile_v2.0_cls_infer.onnx",
)
ORT_FILES = (
    "ort-wasm-simd-threaded.wasm",
    "ort-wasm-simd-threaded.mjs",
)


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def _find_rapidocr_models_dir() -> Path:
    try:
        import rapidocr_onnxruntime  # type: ignore[import-untyped]

        candidate = Path(rapidocr_onnxruntime.__file__).resolve().parent / "models"
        if candidate.is_dir():
            return candidate
    except ImportError:
        pass

    venv_site = sorted((ROOT / "backend" / ".venv" / "lib").glob("python*/site-packages"))
    for sp in venv_site:
        candidate = sp / "rapidocr_onnxruntime" / "models"
        if candidate.is_dir():
            return candidate
    raise FileNotFoundError(
        "Could not locate rapidocr_onnxruntime models directory. "
        "Run `cd backend && uv sync` first."
    )


def _extract_character_dict(rec_model: Path, out_txt: Path) -> None:
    import onnxruntime as ort  # type: ignore[import-untyped]

    session = ort.InferenceSession(str(rec_model), providers=["CPUExecutionProvider"])
    meta = session.get_modelmeta().custom_metadata_map
    raw_chars = meta.get("character", "")
    lines = [line for line in raw_chars.splitlines() if line != ""]
    if not lines:
        raise RuntimeError(f"No character dictionary metadata found inside {rec_model.name}")
    out_txt.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    src_models = _find_rapidocr_models_dir()
    OCR_OUT.mkdir(parents=True, exist_ok=True)
    ORT_OUT.mkdir(parents=True, exist_ok=True)

    manifest_files: dict[str, dict[str, int | str]] = {}

    for filename in OCR_FILES:
        src = src_models / filename
        if not src.is_file():
            raise FileNotFoundError(f"Missing RapidOCR model: {src}")
        dst = OCR_OUT / filename
        shutil.copy2(src, dst)
        manifest_files[filename] = {
            "bytes": dst.stat().st_size,
            "sha256": _sha256(dst)[:16],
        }

    dict_path = OCR_OUT / "ppocr_keys_v1.txt"
    _extract_character_dict(OCR_OUT / "ch_PP-OCRv4_rec_infer.onnx", dict_path)
    manifest_files[dict_path.name] = {
        "bytes": dict_path.stat().st_size,
        "sha256": _sha256(dict_path)[:16],
    }

    if not ORT_SRC.is_dir():
        raise FileNotFoundError(
            f"Missing onnxruntime-web dist folder at {ORT_SRC}. "
            "Run `cd frontend && pnpm install` first."
        )
    for filename in ORT_FILES:
        src = ORT_SRC / filename
        if not src.is_file():
            raise FileNotFoundError(f"Missing onnxruntime-web asset: {src}")
        shutil.copy2(src, ORT_OUT / filename)

    total_bytes = sum(int(entry["bytes"]) for entry in manifest_files.values())
    manifest = {
        "version": "ppocr-v4-1",
        "total_bytes": total_bytes,
        "files": manifest_files,
    }
    (OCR_OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(
        f"Prepared browser OCR assets in {OCR_OUT.relative_to(ROOT)} "
        f"({total_bytes / 1_000_000:.2f} MB) + WASM runtime in {ORT_OUT.relative_to(ROOT)}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
