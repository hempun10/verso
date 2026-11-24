"""Document session storage, caching, saved workspace state, and asset management."""

from __future__ import annotations

import base64
import io
import json
import os
import secrets
import threading
import time
import uuid
from collections import OrderedDict
from dataclasses import dataclass, field
from pathlib import Path

import pymupdf
from PIL import Image, ImageOps
from pydantic import TypeAdapter

from editpdf.auth import GUEST_USER, AuthService
from editpdf.classifier import inspect_document
from editpdf.config import Settings, load_settings
from editpdf.models import (
    AssetItem,
    AssetKind,
    DocumentDetail,
    DocumentListItem,
    DocumentSummary,
    FolderItem,
    ImageOverlay,
    PageInfo,
    PageOverlay,
    SaveStateResponse,
    ShareResponse,
    StorageUsageResponse,
    TextBlock,
    TextEdit,
    UserInfo,
)
from editpdf.native_engine import apply_native_edits, extract_native_blocks
from editpdf.overlays import apply_page_overlays
from editpdf.scanned_engine import apply_scanned_edits, extract_scanned_blocks
from editpdf.security import validate_document_upload, validate_image_upload
from editpdf.storage import (
    SqliteWorkspaceRepository,
    StoredAssetRecord,
    StoredDocumentRecord,
    StoredFolderRecord,
    WorkspaceRepository,
    create_repository,
)

DEFAULT_SESSIONS_DIR = Path(__file__).resolve().parents[2] / "tmp" / "sessions"
OVERLAY_LIST_ADAPTER: TypeAdapter[list[PageOverlay]] = TypeAdapter(list[PageOverlay])
EDIT_LIST_ADAPTER: TypeAdapter[list[TextEdit]] = TypeAdapter(list[TextEdit])


def _resolve_sessions_dir(root_dir: Path | None) -> Path:
    if root_dir is not None:
        return root_dir
    env_dir = os.getenv("EDITPDF_SESSIONS_DIR", "").strip()
    return Path(env_dir) if env_dir else DEFAULT_SESSIONS_DIR


@dataclass
class DocumentCacheEntry:
    pdf_path: Path
    pages: list[PageInfo]
    blocks_cache: dict[int, list[TextBlock]] = field(default_factory=dict)


class SessionStore:
    """Manages PDF documents, saved edit/overlay sessions, sharing, and user assets.

    Always keeps the original uploaded PDF immutable so every preview and export
    replays edits cleanly from scratch without compounding artifacts.
    """

    def __init__(
        self,
        root_dir: Path | None = None,
        repository: WorkspaceRepository | None = None,
        settings: Settings | None = None,
    ):
        self.root_dir = _resolve_sessions_dir(root_dir)
        self.cache_dir = self.root_dir / "pdf_cache"
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.settings = settings or load_settings()
        self._auth = AuthService(settings=self.settings)
        if repository is not None:
            self.repo: WorkspaceRepository = repository
        elif root_dir is not None:
            # Explicit root_dir (e.g. pytest tmp_path) always uses isolated local SQLite.
            self.repo = SqliteWorkspaceRepository(self.root_dir)
        else:
            self.repo = create_repository(self.settings, self.root_dir)
        self._cache_lock = threading.Lock()
        self._cache: OrderedDict[str, DocumentCacheEntry] = OrderedDict()
        self._heavy_sem = threading.BoundedSemaphore(self.settings.ocr_concurrency)

    def _check_access(
        self,
        record: StoredDocumentRecord,
        user: UserInfo,
        share_token: str | None = None,
    ) -> bool:
        """Return True if `user` can read/edit `record`."""
        if record.owner_id == user.id:
            return True
        if record.is_shared and record.share_token and share_token:
            return secrets.compare_digest(record.share_token, share_token)
        return False

    def _evict_disk_cache_locked(self, preserve_doc_id: str | None = None) -> None:
        """Keep pdf_cache directory bounded under settings.max_disk_cache_bytes."""
        max_bytes = self.settings.max_disk_cache_bytes
        files: list[tuple[float, int, Path]] = []
        total = 0
        for p in self.cache_dir.glob("*.pdf"):
            try:
                st = p.stat()
                total += st.st_size
                files.append((st.st_mtime, st.st_size, p))
            except OSError:
                continue
        if total <= max_bytes:
            return
        files.sort(key=lambda item: item[0])
        for _mtime, size, path in files:
            if total <= max_bytes:
                break
            if preserve_doc_id and path.stem == preserve_doc_id:
                continue
            try:
                path.unlink(missing_ok=True)
                self._cache.pop(path.stem, None)
                total -= size
            except OSError:
                continue

    def _put_cache_entry(self, doc_id: str, entry: DocumentCacheEntry) -> None:
        with self._cache_lock:
            self._cache[doc_id] = entry
            self._cache.move_to_end(doc_id)
            while len(self._cache) > self.settings.max_cached_docs:
                self._cache.popitem(last=False)
            self._evict_disk_cache_locked(preserve_doc_id=doc_id)

    def _ensure_pdf_cached(self, record: StoredDocumentRecord) -> DocumentCacheEntry:
        with self._cache_lock:
            entry = self._cache.get(record.doc_id)
            if entry is not None and entry.pdf_path.exists():
                self._cache.move_to_end(record.doc_id)
                return entry
        pdf_path = self.cache_dir / f"{record.doc_id}.pdf"
        if not pdf_path.exists():
            pdf_bytes = self.repo.download_file(record.file_id)
            pdf_path.write_bytes(pdf_bytes)
        pages = [PageInfo(**p) for p in json.loads(record.pages_json)]
        entry = DocumentCacheEntry(pdf_path=pdf_path, pages=pages)
        self._put_cache_entry(record.doc_id, entry)
        return entry

    def _require_document(
        self,
        doc_id: str,
        user: UserInfo = GUEST_USER,
        share_token: str | None = None,
    ) -> StoredDocumentRecord:
        if not doc_id or not all(ch.isalnum() or ch in {"_", "-"} for ch in doc_id):
            raise KeyError(doc_id)
        record = self.repo.get_document(doc_id)
        if record is None:
            raise KeyError(doc_id)
        if not self._check_access(record, user, share_token=share_token):
            raise PermissionError("You do not have access to this document.")
        return record

    def _load_asset_bytes(self, asset_id: str) -> bytes | None:
        rec = self.repo.get_asset(asset_id)
        if rec is None:
            return None
        try:
            return self.repo.download_file(rec.file_id)
        except KeyError:
            return None

    def _require_folder(self, folder_id: str, user: UserInfo) -> StoredFolderRecord:
        if not folder_id or not all(ch.isalnum() or ch in {"_", "-"} for ch in folder_id):
            raise KeyError(folder_id)
        folder = self.repo.get_folder(folder_id)
        if folder is None:
            raise KeyError(folder_id)
        if folder.owner_id != user.id:
            raise PermissionError("You do not have access to this folder.")
        return folder

    @staticmethod
    def _image_bytes_to_pdf(raw: bytes) -> bytes:
        """Convert a PNG/JPG/WebP image into a 1-page raster PDF for OCR text editing."""
        try:
            with Image.open(io.BytesIO(raw)) as opened:
                oriented = ImageOps.exif_transpose(opened)
                if oriented.mode in ("RGBA", "LA") or (
                    oriented.mode == "P" and "transparency" in oriented.info
                ):
                    rgba = oriented.convert("RGBA")
                    bg = Image.new("RGB", rgba.size, (255, 255, 255))
                    bg.paste(rgba, mask=rgba.split()[-1])
                    rgb = bg
                else:
                    rgb = oriented.convert("RGB")
                px_w, px_h = rgb.size
                if px_w <= 0 or px_h <= 0:
                    raise ValueError("Invalid image dimensions.")
                buf = io.BytesIO()
                rgb.save(buf, format="PNG")
                png_bytes = buf.getvalue()
        except ValueError:
            raise
        except Exception as exc:
            raise ValueError("Could not decode uploaded image.") from exc

        # Fit comfortably within a standard document canvas while preserving exact aspect ratio.
        scale = min(640.0 / max(1, px_w), 840.0 / max(1, px_h))
        width_pt = round(px_w * scale, 2)
        height_pt = round(px_h * scale, 2)

        pdf = pymupdf.open()
        try:
            page = pdf.new_page(width=width_pt, height=height_pt)
            page.insert_image(page.rect, stream=png_bytes)
            return pdf.tobytes(deflate=True)
        finally:
            pdf.close()

    def create(
        self,
        filename: str,
        pdf_bytes: bytes,
        owner: UserInfo = GUEST_USER,
        folder_id: str | None = None,
    ) -> DocumentSummary:
        upload_kind = validate_document_upload(
            pdf_bytes,
            max_pdf_bytes=self.settings.max_pdf_bytes,
            max_image_bytes=self.settings.max_image_bytes,
        )
        canonical_pdf = (
            self._image_bytes_to_pdf(pdf_bytes) if upload_kind == "image" else pdf_bytes
        )
        self._enforce_storage_quota(owner, len(canonical_pdf))

        clean_folder_id: str | None = None
        if folder_id and folder_id.strip():
            self._require_folder(folder_id.strip(), owner)
            clean_folder_id = folder_id.strip()

        doc_id = uuid.uuid4().hex[:16]
        pdf_path = self.cache_dir / f"{doc_id}.pdf"
        pdf_path.write_bytes(canonical_pdf)

        try:
            with pymupdf.open(pdf_path) as doc:
                if len(doc) == 0:
                    raise ValueError("PDF has no pages.")
                if len(doc) > self.settings.max_pdf_pages:
                    raise ValueError(
                        f"PDF has {len(doc)} pages — maximum allowed is "
                        f"{self.settings.max_pdf_pages} pages."
                    )
                pages = inspect_document(doc)
        except Exception:
            pdf_path.unlink(missing_ok=True)
            raise

        stem = filename.rsplit(".", 1)[0] if "." in filename else filename
        storage_filename = f"{stem or 'document'}.pdf"
        file_id = self.repo.upload_file(
            f"pdf_{doc_id}", storage_filename, canonical_pdf, "application/pdf"
        )
        now = time.time()
        record = StoredDocumentRecord(
            doc_id=doc_id,
            owner_id=owner.id,
            filename=filename,
            file_id=file_id,
            pages_json=json.dumps([p.model_dump() for p in pages]),
            edits_json="[]",
            overlays_json="[]",
            is_shared=False,
            share_token=None,
            version=1,
            updated_by=owner.name,
            created_at=now,
            updated_at=now,
            folder_id=clean_folder_id,
            size_bytes=len(canonical_pdf),
        )
        self.repo.create_document(record)
        self._put_cache_entry(doc_id, DocumentCacheEntry(pdf_path=pdf_path, pages=pages))
        return DocumentSummary(
            doc_id=doc_id,
            filename=filename,
            page_count=len(pages),
            pages=pages,
        )

    def get(
        self,
        doc_id: str,
        user: UserInfo = GUEST_USER,
        share_token: str | None = None,
    ) -> StoredDocumentRecord:
        return self._require_document(doc_id, user=user, share_token=share_token)

    def list_documents(self, user: UserInfo) -> list[DocumentListItem]:
        records = self.repo.list_documents(user.id)
        items: list[DocumentListItem] = []
        for r in records:
            pages = json.loads(r.pages_json)
            edits = json.loads(r.edits_json or "[]")
            overlays = json.loads(r.overlays_json or "[]")
            items.append(
                DocumentListItem(
                    doc_id=r.doc_id,
                    filename=r.filename,
                    page_count=len(pages),
                    edit_count=len(edits),
                    overlay_count=len(overlays),
                    folder_id=r.folder_id,
                    is_shared=r.is_shared,
                    share_token=r.share_token if r.is_shared else None,
                    version=r.version,
                    updated_at=r.updated_at,
                    updated_by=r.updated_by,
                )
            )
        return items

    def get_document_detail(
        self,
        doc_id: str,
        user: UserInfo,
        share_token: str | None = None,
    ) -> DocumentDetail:
        record = self._require_document(doc_id, user=user, share_token=share_token)
        pages = [PageInfo(**p) for p in json.loads(record.pages_json)]
        edits = EDIT_LIST_ADAPTER.validate_json(record.edits_json or "[]")
        raw_overlays = OVERLAY_LIST_ADAPTER.validate_json(record.overlays_json or "[]")
        overlays: list[PageOverlay] = [
            ov.model_copy(update={"asset_url": self._auth.sign_asset_url(ov.asset_id)})
            if isinstance(ov, ImageOverlay) and ov.asset_id
            else ov
            for ov in raw_overlays
        ]
        is_owner = record.owner_id == user.id
        return DocumentDetail(
            doc_id=record.doc_id,
            filename=record.filename,
            page_count=len(pages),
            pages=pages,
            owner_id=record.owner_id,
            is_owner=is_owner,
            folder_id=record.folder_id,
            is_shared=record.is_shared,
            share_token=record.share_token if (is_owner or record.is_shared) else None,
            edits=edits,
            overlays=overlays,
            version=record.version,
            updated_at=record.updated_at,
            updated_by=record.updated_by,
        )

    def save_document_state(
        self,
        doc_id: str,
        user: UserInfo,
        edits: list[TextEdit],
        overlays: list[PageOverlay],
        share_token: str | None = None,
    ) -> SaveStateResponse:
        record = self._require_document(doc_id, user=user, share_token=share_token)

        # Strip redundant inline base64 data_url and ephemeral signed asset_url before persisting.
        compact_overlays: list[PageOverlay] = []
        for ov in overlays:
            if isinstance(ov, ImageOverlay) and ov.asset_id:
                compact_overlays.append(ov.model_copy(update={"data_url": None, "asset_url": None}))
            elif isinstance(ov, ImageOverlay):
                compact_overlays.append(ov.model_copy(update={"asset_url": None}))
            else:
                compact_overlays.append(ov)

        next_version = record.version + 1
        now = time.time()
        edits_json = json.dumps([e.model_dump() for e in edits])
        overlays_json = json.dumps([o.model_dump() for o in compact_overlays])
        if (
            len(edits_json) > self.settings.max_state_chars
            or len(overlays_json) > self.settings.max_state_chars
        ):
            raise OverflowError(
                "Saved session exceeds storage size limit. Remove unused overlays and try again."
            )
        self.repo.update_document_state(
            doc_id=doc_id,
            edits_json=edits_json,
            overlays_json=overlays_json,
            version=next_version,
            updated_by=user.name or user.email,
            updated_at=now,
        )
        return SaveStateResponse(
            version=next_version,
            updated_at=now,
            updated_by=user.name or user.email,
        )

    def set_document_share(
        self, doc_id: str, user: UserInfo, is_shared: bool
    ) -> ShareResponse:
        record = self._require_document(doc_id, user=user)
        if record.owner_id != user.id:
            raise PermissionError("Only the document owner can manage sharing.")
        token = record.share_token if is_shared else None
        if is_shared and not token:
            token = secrets.token_urlsafe(18)
        self.repo.update_document_share(doc_id, is_shared, token)
        return ShareResponse(is_shared=is_shared, share_token=token)

    def move_document_to_folder(
        self, doc_id: str, user: UserInfo, folder_id: str | None
    ) -> None:
        record = self._require_document(doc_id, user=user)
        if record.owner_id != user.id:
            raise PermissionError("Only the document owner can move this document.")
        target_id = folder_id.strip() if folder_id and folder_id.strip() else None
        if target_id is not None:
            self._require_folder(target_id, user)
        self.repo.update_document_folder(doc_id, target_id)

    def delete_document(self, doc_id: str, user: UserInfo) -> None:
        record = self._require_document(doc_id, user=user)
        if record.owner_id != user.id:
            raise PermissionError("Only the document owner can delete this document.")
        self.repo.delete_document(doc_id)
        self.repo.delete_file(record.file_id)
        with self._cache_lock:
            cached = self._cache.pop(doc_id, None)
        if cached and cached.pdf_path.exists():
            cached.pdf_path.unlink(missing_ok=True)

    # --- Google Drive–Style Folders ---

    @staticmethod
    def _folder_to_item(r: StoredFolderRecord) -> FolderItem:
        return FolderItem(
            folder_id=r.folder_id,
            name=r.name,
            parent_id=r.parent_id,
            created_at=r.created_at,
            updated_at=r.updated_at,
        )

    def list_folders(self, user: UserInfo) -> list[FolderItem]:
        return [self._folder_to_item(f) for f in self.repo.list_folders(user.id)]

    def create_folder(
        self, user: UserInfo, name: str, parent_id: str | None = None
    ) -> FolderItem:
        clean_name = name.strip()
        if not clean_name:
            raise ValueError("Folder name cannot be empty.")
        clean_parent = parent_id.strip() if parent_id and parent_id.strip() else None
        if clean_parent is not None:
            self._require_folder(clean_parent, user)
        now = time.time()
        record = StoredFolderRecord(
            folder_id=f"fld_{uuid.uuid4().hex[:14]}",
            owner_id=user.id,
            name=clean_name,
            parent_id=clean_parent,
            created_at=now,
            updated_at=now,
        )
        self.repo.create_folder(record)
        return self._folder_to_item(record)

    def update_folder(
        self,
        folder_id: str,
        user: UserInfo,
        *,
        name: str | None = None,
        parent_id: str | None = None,
        move_parent: bool = False,
    ) -> FolderItem:
        folder = self._require_folder(folder_id, user)
        next_name = folder.name
        if name is not None:
            stripped = name.strip()
            if not stripped:
                raise ValueError("Folder name cannot be empty.")
            next_name = stripped

        next_parent = folder.parent_id
        if move_parent:
            next_parent = parent_id.strip() if parent_id and parent_id.strip() else None
            if next_parent == folder.folder_id:
                raise ValueError("A folder cannot be moved into itself.")
            if next_parent is not None:
                # Verify parent exists and does not create a cycle.
                all_folders = {f.folder_id: f for f in self.repo.list_folders(user.id)}
                if next_parent not in all_folders:
                    raise KeyError(next_parent)
                cursor: str | None = next_parent
                seen: set[str] = set()
                while cursor:
                    if cursor == folder.folder_id:
                        raise ValueError("Cannot move a folder into one of its subfolders.")
                    if cursor in seen:
                        break
                    seen.add(cursor)
                    parent_rec = all_folders.get(cursor)
                    cursor = parent_rec.parent_id if parent_rec else None

        now = time.time()
        self.repo.update_folder(folder.folder_id, next_name, next_parent, now)
        return FolderItem(
            folder_id=folder.folder_id,
            name=next_name,
            parent_id=next_parent,
            created_at=folder.created_at,
            updated_at=now,
        )

    def delete_folder(self, folder_id: str, user: UserInfo) -> None:
        folder = self._require_folder(folder_id, user)
        # Safely move any child documents and child folders up to the parent folder.
        now = time.time()
        for doc in self.repo.list_documents(user.id):
            if doc.folder_id == folder.folder_id:
                self.repo.update_document_folder(doc.doc_id, folder.parent_id)
        for child in self.repo.list_folders(user.id):
            if child.parent_id == folder.folder_id:
                self.repo.update_folder(child.folder_id, child.name, folder.parent_id, now)
        self.repo.delete_folder(folder.folder_id)

    # --- Saved Signatures & Image Assets ---

    def create_asset(
        self,
        user: UserInfo,
        kind: AssetKind,
        name: str,
        data_url: str,
    ) -> AssetItem:
        raw = data_url.strip()
        mime_type = "image/png"
        if "," in raw and raw.lower().startswith("data:"):
            header, b64_part = raw.split(",", 1)
            if ";" in header:
                mime_type = header[5:].split(";", 1)[0] or "image/png"
        else:
            b64_part = raw

        try:
            img_bytes = base64.b64decode(b64_part)
        except Exception as exc:
            raise ValueError("Invalid base64 image data.") from exc

        validate_image_upload(img_bytes, mime_type, self.settings.max_image_bytes)
        self._enforce_storage_quota(user, len(img_bytes))

        try:
            with Image.open(io.BytesIO(img_bytes)) as img:
                width, height = img.size
        except Exception as exc:
            raise ValueError("Invalid image file.") from exc

        asset_id = f"{kind[:3]}_{uuid.uuid4().hex[:14]}"
        ext = "png" if mime_type == "image/png" else "jpg" if mime_type == "image/jpeg" else "webp"
        file_id = self.repo.upload_file(
            f"ast_{asset_id}", f"{asset_id}.{ext}", img_bytes, mime_type
        )
        now = time.time()
        record = StoredAssetRecord(
            asset_id=asset_id,
            owner_id=user.id,
            kind=kind,
            name=name.strip() or ("Signature" if kind == "signature" else "Image"),
            mime_type=mime_type,
            file_id=file_id,
            width=int(width),
            height=int(height),
            created_at=now,
            size_bytes=len(img_bytes),
        )
        self.repo.create_asset(record)
        return self._asset_to_item(record)

    def _asset_to_item(self, r: StoredAssetRecord) -> AssetItem:
        kind: AssetKind = "signature" if r.kind == "signature" else "image"
        return AssetItem(
            asset_id=r.asset_id,
            kind=kind,
            name=r.name,
            mime_type=r.mime_type,
            width=r.width,
            height=r.height,
            created_at=r.created_at,
            url=self._auth.sign_asset_url(r.asset_id),
        )

    def list_assets(self, user: UserInfo, kind: AssetKind | None = None) -> list[AssetItem]:
        records = self.repo.list_assets(user.id, kind=kind)
        return [self._asset_to_item(r) for r in records]

    def get_asset_content(
        self,
        asset_id: str,
        *,
        user: UserInfo | None = None,
        exp: int | None = None,
        sig: str | None = None,
    ) -> tuple[bytes, str]:
        record = self.repo.get_asset(asset_id)
        if record is None:
            raise KeyError(asset_id)
        has_valid_sig = self._auth.verify_asset_signature(asset_id, exp, sig)
        is_owner = user is not None and record.owner_id == user.id
        if not (has_valid_sig or is_owner):
            raise PermissionError("You do not have access to this asset.")
        data = self.repo.download_file(record.file_id)
        return data, record.mime_type

    def delete_asset(self, asset_id: str, user: UserInfo) -> None:
        record = self.repo.get_asset(asset_id)
        if record is None:
            raise KeyError(asset_id)
        if record.owner_id != user.id:
            raise PermissionError("You do not own this asset.")
        self.repo.delete_asset(asset_id)
        self.repo.delete_file(record.file_id)

    def _enforce_storage_quota(self, user: UserInfo, incoming_bytes: int) -> None:
        usage = self.get_storage_usage(user)
        if usage.used_bytes + incoming_bytes > usage.quota_bytes:
            raise OverflowError(
                "Storage quota exceeded. Delete unused files or assets to free up space."
            )

    def get_storage_usage(self, user: UserInfo) -> StorageUsageResponse:
        docs = self.repo.list_documents(user.id)
        assets = self.repo.list_assets(user.id)
        known_bytes = 0
        legacy_file_ids: list[str] = []
        for d in docs:
            if d.size_bytes > 0:
                known_bytes += d.size_bytes
            else:
                legacy_file_ids.append(d.file_id)
        for a in assets:
            if a.size_bytes > 0:
                known_bytes += a.size_bytes
            else:
                legacy_file_ids.append(a.file_id)
        legacy_bytes = self.repo.get_storage_used_bytes(legacy_file_ids) if legacy_file_ids else 0
        return StorageUsageResponse(
            used_bytes=known_bytes + legacy_bytes,
            quota_bytes=self.settings.storage_quota_bytes,
            document_count=len(docs),
            asset_count=len(assets),
        )

    # --- PDF Rendering & Export ---

    def get_page_blocks(
        self,
        doc_id: str,
        page_index: int,
        user: UserInfo = GUEST_USER,
        share_token: str | None = None,
    ) -> list[TextBlock]:
        record = self._require_document(doc_id, user=user, share_token=share_token)
        entry = self._ensure_pdf_cached(record)
        if page_index < 0 or page_index >= len(entry.pages):
            raise IndexError(f"Page index {page_index} out of range")

        if page_index in entry.blocks_cache:
            return entry.blocks_cache[page_index]

        page_info = entry.pages[page_index]
        with self._heavy_sem, pymupdf.open(entry.pdf_path) as doc:
            page = doc[page_index]
            if page_info.kind == "native":
                blocks = extract_native_blocks(page, page_index)
            else:
                blocks = extract_scanned_blocks(page, page_index)

        entry.blocks_cache[page_index] = blocks
        return blocks

    def _resolve_blocks_for_edits(
        self,
        doc_id: str,
        page_info: PageInfo,
        edits: list[TextEdit],
        *,
        user: UserInfo,
        share_token: str | None,
    ) -> tuple[list[TextBlock], list[TextEdit]]:
        """Resolve matching TextBlocks for a page's edits, skipping server OCR when possible."""
        idx = page_info.page_index
        prefix = f"p{idx}_"
        candidates = [
            e
            for e in edits
            if (e.source_block is not None and e.source_block.page_index == idx)
            or (e.source_block is None and e.block_id.startswith(prefix))
        ]
        if not candidates:
            return [], []

        if page_info.kind == "scanned":
            client_blocks: dict[str, TextBlock] = {}
            missing_source = False
            for edit in candidates:
                sb = edit.source_block
                if sb is not None and sb.page_index == idx and sb.id == edit.block_id:
                    client_blocks[sb.id] = sb
                else:
                    missing_source = True
            if not missing_source and client_blocks:
                return list(client_blocks.values()), candidates
            server_blocks = self.get_page_blocks(
                doc_id, idx, user=user, share_token=share_token
            )
            merged = {b.id: b for b in server_blocks}
            merged.update(client_blocks)
            matched = [e for e in candidates if e.block_id in merged]
            return list(merged.values()), matched

        blocks = self.get_page_blocks(doc_id, idx, user=user, share_token=share_token)
        block_ids = {b.id for b in blocks}
        matched = [e for e in candidates if e.block_id in block_ids]
        return blocks, matched

    def render_page_png(
        self,
        doc_id: str,
        page_index: int,
        edits: list[TextEdit] | None = None,
        overlays: list[PageOverlay] | None = None,
        dpi: int = 150,
        user: UserInfo = GUEST_USER,
        share_token: str | None = None,
    ) -> bytes:
        record = self._require_document(doc_id, user=user, share_token=share_token)
        entry = self._ensure_pdf_cached(record)
        if page_index < 0 or page_index >= len(entry.pages):
            raise IndexError(f"Page index {page_index} out of range")

        page_info = entry.pages[page_index]
        blocks: list[TextBlock] = []
        matched_edits: list[TextEdit] = []
        if edits:
            blocks, matched_edits = self._resolve_blocks_for_edits(
                doc_id,
                page_info,
                edits,
                user=user,
                share_token=share_token,
            )
        with self._heavy_sem, pymupdf.open(entry.pdf_path) as doc:
            if matched_edits:
                if page_info.kind == "native":
                    apply_native_edits(doc, page_index, blocks, matched_edits)
                else:
                    apply_scanned_edits(doc, page_index, blocks, matched_edits)
            if overlays:
                apply_page_overlays(
                    doc[page_index],
                    page_index,
                    overlays,
                    asset_loader=self._load_asset_bytes,
                )
            pix = doc[page_index].get_pixmap(dpi=dpi, alpha=False)
            return pix.tobytes("png")

    def export_pdf(
        self,
        doc_id: str,
        edits: list[TextEdit],
        overlays: list[PageOverlay] | None = None,
        user: UserInfo = GUEST_USER,
        share_token: str | None = None,
    ) -> bytes:
        record = self._require_document(doc_id, user=user, share_token=share_token)
        entry = self._ensure_pdf_cached(record)
        active_overlays = overlays or []
        if not edits and not active_overlays:
            return entry.pdf_path.read_bytes()

        with self._heavy_sem, pymupdf.open(entry.pdf_path) as doc:
            for page_info in entry.pages:
                idx = page_info.page_index
                page_overlays = [o for o in active_overlays if o.page_index == idx]
                if edits:
                    blocks, page_edits = self._resolve_blocks_for_edits(
                        doc_id,
                        page_info,
                        edits,
                        user=user,
                        share_token=share_token,
                    )
                    if page_edits:
                        if page_info.kind == "native":
                            apply_native_edits(doc, idx, blocks, page_edits)
                        else:
                            apply_scanned_edits(doc, idx, blocks, page_edits)
                if page_overlays:
                    apply_page_overlays(
                        doc[idx],
                        idx,
                        page_overlays,
                        asset_loader=self._load_asset_bytes,
                    )
            return doc.tobytes(garbage=3, deflate=True)
