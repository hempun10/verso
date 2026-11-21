"""Persistence repositories for documents, edit sessions, and saved signatures/images.

Supports two interchangeable backends behind `WorkspaceRepository`:
- `AppwriteWorkspaceRepository`: Appwrite Databases + Appwrite Storage buckets.
- `SqliteWorkspaceRepository`: Zero-setup local SQLite + disk storage fallback.
"""

from __future__ import annotations

import json
import sqlite3
import threading
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol

import httpx

from editpdf.config import Settings


@dataclass
class StoredDocumentRecord:
    doc_id: str
    owner_id: str
    filename: str
    file_id: str
    pages_json: str
    edits_json: str
    overlays_json: str
    is_shared: bool
    share_token: str | None
    version: int
    updated_by: str
    created_at: float
    updated_at: float
    folder_id: str | None = None
    size_bytes: int = 0


@dataclass
class StoredFolderRecord:
    folder_id: str
    owner_id: str
    name: str
    parent_id: str | None
    created_at: float
    updated_at: float


@dataclass
class StoredAssetRecord:
    asset_id: str
    owner_id: str
    kind: str  # "signature" | "image"
    name: str
    mime_type: str
    file_id: str
    width: int
    height: int
    created_at: float
    size_bytes: int = 0


class WorkspaceRepository(Protocol):
    def upload_file(self, file_id: str, filename: str, content: bytes, mime_type: str) -> str: ...
    def download_file(self, file_id: str) -> bytes: ...
    def delete_file(self, file_id: str) -> None: ...

    def create_document(self, record: StoredDocumentRecord) -> None: ...
    def get_document(self, doc_id: str) -> StoredDocumentRecord | None: ...
    def list_documents(self, owner_id: str) -> list[StoredDocumentRecord]: ...
    def update_document_state(
        self,
        doc_id: str,
        edits_json: str,
        overlays_json: str,
        version: int,
        updated_by: str,
        updated_at: float,
    ) -> None: ...
    def update_document_share(
        self, doc_id: str, is_shared: bool, share_token: str | None
    ) -> None: ...
    def update_document_folder(self, doc_id: str, folder_id: str | None) -> None: ...
    def delete_document(self, doc_id: str) -> None: ...

    def create_folder(self, record: StoredFolderRecord) -> None: ...
    def get_folder(self, folder_id: str) -> StoredFolderRecord | None: ...
    def list_folders(self, owner_id: str) -> list[StoredFolderRecord]: ...
    def update_folder(
        self, folder_id: str, name: str, parent_id: str | None, updated_at: float
    ) -> None: ...
    def delete_folder(self, folder_id: str) -> None: ...

    def create_asset(self, record: StoredAssetRecord) -> None: ...
    def get_asset(self, asset_id: str) -> StoredAssetRecord | None: ...
    def list_assets(self, owner_id: str, kind: str | None = None) -> list[StoredAssetRecord]: ...
    def delete_asset(self, asset_id: str) -> None: ...
    def get_storage_used_bytes(self, file_ids: list[str]) -> int: ...


class SqliteWorkspaceRepository:
    """Local SQLite + disk blob store used when Appwrite credentials are not configured."""

    def __init__(self, root_dir: Path):
        self.root_dir = root_dir
        self.files_dir = root_dir / "files"
        self.files_dir.mkdir(parents=True, exist_ok=True)
        self.db_path = root_dir / "workspace.db"
        self._lock = threading.Lock()
        self._init_schema()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_schema(self) -> None:
        with self._lock, self._connect() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS documents (
                    doc_id TEXT PRIMARY KEY,
                    owner_id TEXT NOT NULL,
                    filename TEXT NOT NULL,
                    file_id TEXT NOT NULL,
                    pages_json TEXT NOT NULL,
                    edits_json TEXT NOT NULL,
                    overlays_json TEXT NOT NULL,
                    is_shared INTEGER NOT NULL DEFAULT 0,
                    share_token TEXT,
                    version INTEGER NOT NULL DEFAULT 1,
                    updated_by TEXT NOT NULL DEFAULT '',
                    created_at REAL NOT NULL,
                    updated_at REAL NOT NULL,
                    folder_id TEXT,
                    size_bytes INTEGER NOT NULL DEFAULT 0
                );
                CREATE INDEX IF NOT EXISTS idx_documents_owner
                    ON documents(owner_id, updated_at DESC);

                CREATE TABLE IF NOT EXISTS folders (
                    folder_id TEXT PRIMARY KEY,
                    owner_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    parent_id TEXT,
                    created_at REAL NOT NULL,
                    updated_at REAL NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_folders_owner
                    ON folders(owner_id, updated_at DESC);

                CREATE TABLE IF NOT EXISTS assets (
                    asset_id TEXT PRIMARY KEY,
                    owner_id TEXT NOT NULL,
                    kind TEXT NOT NULL,
                    name TEXT NOT NULL,
                    mime_type TEXT NOT NULL,
                    file_id TEXT NOT NULL,
                    width INTEGER NOT NULL,
                    height INTEGER NOT NULL,
                    created_at REAL NOT NULL,
                    size_bytes INTEGER NOT NULL DEFAULT 0
                );
                CREATE INDEX IF NOT EXISTS idx_assets_owner_kind
                    ON assets(owner_id, kind, created_at DESC);
                """
            )
            # Migrate older SQLite databases cleanly.
            doc_cols = {
                str(r["name"])
                for r in conn.execute("PRAGMA table_info(documents)").fetchall()
            }
            if "folder_id" not in doc_cols:
                conn.execute("ALTER TABLE documents ADD COLUMN folder_id TEXT")
            if "size_bytes" not in doc_cols:
                conn.execute(
                    "ALTER TABLE documents ADD COLUMN size_bytes INTEGER NOT NULL DEFAULT 0"
                )
            asset_cols = {
                str(r["name"])
                for r in conn.execute("PRAGMA table_info(assets)").fetchall()
            }
            if "size_bytes" not in asset_cols:
                conn.execute("ALTER TABLE assets ADD COLUMN size_bytes INTEGER NOT NULL DEFAULT 0")

    def upload_file(self, file_id: str, filename: str, content: bytes, mime_type: str) -> str:
        _ = filename, mime_type
        safe_id = file_id.replace("/", "_")
        (self.files_dir / safe_id).write_bytes(content)
        return safe_id

    def download_file(self, file_id: str) -> bytes:
        path = self.files_dir / file_id
        if not path.exists():
            raise KeyError(f"File not found: {file_id}")
        return path.read_bytes()

    def delete_file(self, file_id: str) -> None:
        path = self.files_dir / file_id
        if path.exists():
            path.unlink(missing_ok=True)

    @staticmethod
    def _row_to_doc(row: sqlite3.Row) -> StoredDocumentRecord:
        return StoredDocumentRecord(
            doc_id=str(row["doc_id"]),
            owner_id=str(row["owner_id"]),
            filename=str(row["filename"]),
            file_id=str(row["file_id"]),
            pages_json=str(row["pages_json"]),
            edits_json=str(row["edits_json"]),
            overlays_json=str(row["overlays_json"]),
            is_shared=bool(row["is_shared"]),
            share_token=str(row["share_token"]) if row["share_token"] else None,
            version=int(row["version"]),
            updated_by=str(row["updated_by"]),
            created_at=float(row["created_at"]),
            updated_at=float(row["updated_at"]),
            folder_id=str(row["folder_id"]) if row["folder_id"] else None,
            size_bytes=int(row["size_bytes"] or 0),
        )

    @staticmethod
    def _row_to_folder(row: sqlite3.Row) -> StoredFolderRecord:
        return StoredFolderRecord(
            folder_id=str(row["folder_id"]),
            owner_id=str(row["owner_id"]),
            name=str(row["name"]),
            parent_id=str(row["parent_id"]) if row["parent_id"] else None,
            created_at=float(row["created_at"]),
            updated_at=float(row["updated_at"]),
        )

    @staticmethod
    def _row_to_asset(row: sqlite3.Row) -> StoredAssetRecord:
        return StoredAssetRecord(
            asset_id=str(row["asset_id"]),
            owner_id=str(row["owner_id"]),
            kind=str(row["kind"]),
            name=str(row["name"]),
            mime_type=str(row["mime_type"]),
            file_id=str(row["file_id"]),
            width=int(row["width"]),
            height=int(row["height"]),
            created_at=float(row["created_at"]),
            size_bytes=int(row["size_bytes"] or 0),
        )

    def create_document(self, record: StoredDocumentRecord) -> None:
        with self._lock, self._connect() as conn:
            conn.execute(
                """
                INSERT INTO documents (
                    doc_id, owner_id, filename, file_id, pages_json, edits_json, overlays_json,
                    is_shared, share_token, version, updated_by, created_at, updated_at, folder_id,
                    size_bytes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    record.doc_id,
                    record.owner_id,
                    record.filename,
                    record.file_id,
                    record.pages_json,
                    record.edits_json,
                    record.overlays_json,
                    1 if record.is_shared else 0,
                    record.share_token,
                    record.version,
                    record.updated_by,
                    record.created_at,
                    record.updated_at,
                    record.folder_id,
                    record.size_bytes,
                ),
            )

    def get_document(self, doc_id: str) -> StoredDocumentRecord | None:
        with self._lock, self._connect() as conn:
            row = conn.execute("SELECT * FROM documents WHERE doc_id = ?", (doc_id,)).fetchone()
            return self._row_to_doc(row) if row else None

    def list_documents(self, owner_id: str) -> list[StoredDocumentRecord]:
        with self._lock, self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM documents WHERE owner_id = ? ORDER BY updated_at DESC",
                (owner_id,),
            ).fetchall()
            return [self._row_to_doc(r) for r in rows]

    def update_document_state(
        self,
        doc_id: str,
        edits_json: str,
        overlays_json: str,
        version: int,
        updated_by: str,
        updated_at: float,
    ) -> None:
        with self._lock, self._connect() as conn:
            conn.execute(
                """
                UPDATE documents
                SET edits_json = ?, overlays_json = ?, version = ?, updated_by = ?, updated_at = ?
                WHERE doc_id = ?
                """,
                (edits_json, overlays_json, version, updated_by, updated_at, doc_id),
            )

    def update_document_share(
        self, doc_id: str, is_shared: bool, share_token: str | None
    ) -> None:
        with self._lock, self._connect() as conn:
            conn.execute(
                "UPDATE documents SET is_shared = ?, share_token = ? WHERE doc_id = ?",
                (1 if is_shared else 0, share_token, doc_id),
            )

    def update_document_folder(self, doc_id: str, folder_id: str | None) -> None:
        with self._lock, self._connect() as conn:
            conn.execute(
                "UPDATE documents SET folder_id = ? WHERE doc_id = ?",
                (folder_id, doc_id),
            )

    def delete_document(self, doc_id: str) -> None:
        with self._lock, self._connect() as conn:
            conn.execute("DELETE FROM documents WHERE doc_id = ?", (doc_id,))

    def create_folder(self, record: StoredFolderRecord) -> None:
        with self._lock, self._connect() as conn:
            conn.execute(
                """
                INSERT INTO folders (
                    folder_id, owner_id, name, parent_id, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    record.folder_id,
                    record.owner_id,
                    record.name,
                    record.parent_id,
                    record.created_at,
                    record.updated_at,
                ),
            )

    def get_folder(self, folder_id: str) -> StoredFolderRecord | None:
        with self._lock, self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM folders WHERE folder_id = ?", (folder_id,)
            ).fetchone()
            return self._row_to_folder(row) if row else None

    def list_folders(self, owner_id: str) -> list[StoredFolderRecord]:
        with self._lock, self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM folders WHERE owner_id = ? ORDER BY name COLLATE NOCASE ASC",
                (owner_id,),
            ).fetchall()
            return [self._row_to_folder(r) for r in rows]

    def update_folder(
        self, folder_id: str, name: str, parent_id: str | None, updated_at: float
    ) -> None:
        with self._lock, self._connect() as conn:
            conn.execute(
                "UPDATE folders SET name = ?, parent_id = ?, updated_at = ? WHERE folder_id = ?",
                (name, parent_id, updated_at, folder_id),
            )

    def delete_folder(self, folder_id: str) -> None:
        with self._lock, self._connect() as conn:
            conn.execute("DELETE FROM folders WHERE folder_id = ?", (folder_id,))

    def create_asset(self, record: StoredAssetRecord) -> None:
        with self._lock, self._connect() as conn:
            conn.execute(
                """
                INSERT INTO assets (
                    asset_id, owner_id, kind, name, mime_type, file_id, width, height, created_at,
                    size_bytes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    record.asset_id,
                    record.owner_id,
                    record.kind,
                    record.name,
                    record.mime_type,
                    record.file_id,
                    record.width,
                    record.height,
                    record.created_at,
                    record.size_bytes,
                ),
            )

    def get_asset(self, asset_id: str) -> StoredAssetRecord | None:
        with self._lock, self._connect() as conn:
            row = conn.execute("SELECT * FROM assets WHERE asset_id = ?", (asset_id,)).fetchone()
            return self._row_to_asset(row) if row else None

    def list_assets(self, owner_id: str, kind: str | None = None) -> list[StoredAssetRecord]:
        with self._lock, self._connect() as conn:
            if kind:
                rows = conn.execute(
                    "SELECT * FROM assets WHERE owner_id = ? AND kind = ? ORDER BY created_at DESC",
                    (owner_id, kind),
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT * FROM assets WHERE owner_id = ? ORDER BY created_at DESC",
                    (owner_id,),
                ).fetchall()
            return [self._row_to_asset(r) for r in rows]

    def delete_asset(self, asset_id: str) -> None:
        with self._lock, self._connect() as conn:
            conn.execute("DELETE FROM assets WHERE asset_id = ?", (asset_id,))

    def get_storage_used_bytes(self, file_ids: list[str]) -> int:
        total = 0
        for fid in file_ids:
            path = self.files_dir / fid
            if path.exists():
                total += path.stat().st_size
        return total


class AppwriteWorkspaceRepository:
    """Appwrite TablesDB + Appwrite Storage REST repository."""

    def __init__(self, settings: Settings):
        self.endpoint = settings.appwrite_endpoint.rstrip("/")
        self.project_id = settings.appwrite_project_id
        self.api_key = settings.appwrite_api_key
        self.db_id = settings.appwrite_database_id
        self.docs_col = settings.appwrite_documents_collection_id
        self.assets_col = settings.appwrite_assets_collection_id
        self.folders_col = settings.appwrite_folders_collection_id
        self.bucket_id = settings.appwrite_bucket_id

    def _headers(self, json_body: bool = True) -> dict[str, str]:
        headers = {
            "X-Appwrite-Project": self.project_id,
            "X-Appwrite-Key": self.api_key,
        }
        if json_body:
            headers["Content-Type"] = "application/json"
        return headers

    def _rows_url(self, table_id: str) -> str:
        return f"{self.endpoint}/tablesdb/{self.db_id}/tables/{table_id}/rows"

    def upload_file(self, file_id: str, filename: str, content: bytes, mime_type: str) -> str:
        url = f"{self.endpoint}/storage/buckets/{self.bucket_id}/files"
        safe_id = file_id[:36] or uuid.uuid4().hex[:20]
        with httpx.Client(timeout=30.0) as client:
            res = client.post(
                url,
                headers=self._headers(json_body=False),
                data={"fileId": safe_id},
                files={"file": (filename, content, mime_type)},
            )
        res.raise_for_status()
        return str(res.json()["$id"])

    def download_file(self, file_id: str) -> bytes:
        url = f"{self.endpoint}/storage/buckets/{self.bucket_id}/files/{file_id}/download"
        with httpx.Client(timeout=30.0) as client:
            res = client.get(url, headers=self._headers(json_body=False))
        if res.status_code == 404:
            raise KeyError(file_id)
        res.raise_for_status()
        return res.content

    def delete_file(self, file_id: str) -> None:
        url = f"{self.endpoint}/storage/buckets/{self.bucket_id}/files/{file_id}"
        with httpx.Client(timeout=15.0) as client:
            client.delete(url, headers=self._headers(json_body=False))

    def _list_all_rows(self, table_id: str, base_queries: list[str]) -> list[dict[str, Any]]:
        """Cursor-paginate Appwrite TablesDB rows so results are never capped at 25."""
        all_rows: list[dict[str, Any]] = []
        cursor: str | None = None
        page_size = 100
        with httpx.Client(timeout=15.0) as client:
            while True:
                queries = [
                    *base_queries,
                    json.dumps({"method": "limit", "values": [page_size]}),
                ]
                if cursor is not None:
                    queries.append(json.dumps({"method": "cursorAfter", "values": [cursor]}))
                res = client.get(
                    self._rows_url(table_id),
                    headers=self._headers(),
                    params={"queries[]": queries},
                )
                res.raise_for_status()
                batch = res.json().get("rows", [])
                if not batch:
                    break
                all_rows.extend(batch)
                if len(batch) < page_size:
                    break
                cursor = str(batch[-1]["$id"])
        return all_rows

    def _post_row_with_optional_size(self, table_id: str, payload: dict[str, Any]) -> None:
        """Create a row, gracefully retrying without size_bytes if schema hasn't migrated yet."""
        url = self._rows_url(table_id)
        with httpx.Client(timeout=15.0) as client:
            res = client.post(url, headers=self._headers(), json=payload)
            if res.status_code == 400 and "size_bytes" in res.text:
                fallback = {
                    "rowId": payload["rowId"],
                    "data": {k: v for k, v in payload["data"].items() if k != "size_bytes"},
                }
                res = client.post(url, headers=self._headers(), json=fallback)
        res.raise_for_status()

    @staticmethod
    def _doc_from_json(d: dict[str, Any]) -> StoredDocumentRecord:
        return StoredDocumentRecord(
            doc_id=str(d["$id"]),
            owner_id=str(d["owner_id"]),
            filename=str(d["filename"]),
            file_id=str(d["file_id"]),
            pages_json=str(d["pages_json"]),
            edits_json=str(d.get("edits_json") or "[]"),
            overlays_json=str(d.get("overlays_json") or "[]"),
            is_shared=bool(d.get("is_shared", False)),
            share_token=str(d["share_token"]) if d.get("share_token") else None,
            version=int(d.get("version", 1)),
            updated_by=str(d.get("updated_by") or ""),
            created_at=float(d.get("created_at", 0.0)),
            updated_at=float(d.get("updated_at", 0.0)),
            folder_id=str(d["folder_id"]) if d.get("folder_id") else None,
            size_bytes=int(d.get("size_bytes") or 0),
        )

    @staticmethod
    def _folder_from_json(d: dict[str, Any]) -> StoredFolderRecord:
        return StoredFolderRecord(
            folder_id=str(d["$id"]),
            owner_id=str(d["owner_id"]),
            name=str(d["name"]),
            parent_id=str(d["parent_id"]) if d.get("parent_id") else None,
            created_at=float(d.get("created_at", 0.0)),
            updated_at=float(d.get("updated_at", 0.0)),
        )

    @staticmethod
    def _asset_from_json(d: dict[str, Any]) -> StoredAssetRecord:
        return StoredAssetRecord(
            asset_id=str(d["$id"]),
            owner_id=str(d["owner_id"]),
            kind=str(d["kind"]),
            name=str(d["name"]),
            mime_type=str(d["mime_type"]),
            file_id=str(d["file_id"]),
            width=int(d.get("width", 100)),
            height=int(d.get("height", 100)),
            created_at=float(d.get("created_at", 0.0)),
            size_bytes=int(d.get("size_bytes") or 0),
        )

    def create_document(self, record: StoredDocumentRecord) -> None:
        payload = {
            "rowId": record.doc_id,
            "data": {
                "owner_id": record.owner_id,
                "filename": record.filename,
                "file_id": record.file_id,
                "pages_json": record.pages_json,
                "edits_json": record.edits_json,
                "overlays_json": record.overlays_json,
                "is_shared": record.is_shared,
                "share_token": record.share_token or "",
                "version": record.version,
                "updated_by": record.updated_by,
                "created_at": record.created_at,
                "updated_at": record.updated_at,
                "folder_id": record.folder_id or "",
                "size_bytes": record.size_bytes,
            },
        }
        self._post_row_with_optional_size(self.docs_col, payload)

    def get_document(self, doc_id: str) -> StoredDocumentRecord | None:
        url = f"{self._rows_url(self.docs_col)}/{doc_id}"
        with httpx.Client(timeout=15.0) as client:
            res = client.get(url, headers=self._headers())
        if res.status_code == 404:
            return None
        res.raise_for_status()
        return self._doc_from_json(res.json())

    def list_documents(self, owner_id: str) -> list[StoredDocumentRecord]:
        q_equal = json.dumps({"method": "equal", "attribute": "owner_id", "values": [owner_id]})
        q_order = json.dumps({"method": "orderDesc", "attribute": "updated_at"})
        rows = self._list_all_rows(self.docs_col, [q_equal, q_order])
        return [self._doc_from_json(d) for d in rows]

    def update_document_state(
        self,
        doc_id: str,
        edits_json: str,
        overlays_json: str,
        version: int,
        updated_by: str,
        updated_at: float,
    ) -> None:
        url = f"{self._rows_url(self.docs_col)}/{doc_id}"
        payload = {
            "data": {
                "edits_json": edits_json,
                "overlays_json": overlays_json,
                "version": version,
                "updated_by": updated_by,
                "updated_at": updated_at,
            }
        }
        with httpx.Client(timeout=15.0) as client:
            res = client.patch(url, headers=self._headers(), json=payload)
        res.raise_for_status()

    def update_document_share(
        self, doc_id: str, is_shared: bool, share_token: str | None
    ) -> None:
        url = f"{self._rows_url(self.docs_col)}/{doc_id}"
        payload = {"data": {"is_shared": is_shared, "share_token": share_token or ""}}
        with httpx.Client(timeout=15.0) as client:
            res = client.patch(url, headers=self._headers(), json=payload)
        res.raise_for_status()

    def update_document_folder(self, doc_id: str, folder_id: str | None) -> None:
        url = f"{self._rows_url(self.docs_col)}/{doc_id}"
        payload = {"data": {"folder_id": folder_id or ""}}
        with httpx.Client(timeout=15.0) as client:
            res = client.patch(url, headers=self._headers(), json=payload)
        res.raise_for_status()

    def delete_document(self, doc_id: str) -> None:
        url = f"{self._rows_url(self.docs_col)}/{doc_id}"
        with httpx.Client(timeout=15.0) as client:
            client.delete(url, headers=self._headers())

    def create_folder(self, record: StoredFolderRecord) -> None:
        payload = {
            "rowId": record.folder_id,
            "data": {
                "owner_id": record.owner_id,
                "name": record.name,
                "parent_id": record.parent_id or "",
                "created_at": record.created_at,
                "updated_at": record.updated_at,
            },
        }
        with httpx.Client(timeout=15.0) as client:
            res = client.post(
                self._rows_url(self.folders_col), headers=self._headers(), json=payload
            )
        res.raise_for_status()

    def get_folder(self, folder_id: str) -> StoredFolderRecord | None:
        url = f"{self._rows_url(self.folders_col)}/{folder_id}"
        with httpx.Client(timeout=15.0) as client:
            res = client.get(url, headers=self._headers())
        if res.status_code == 404:
            return None
        res.raise_for_status()
        return self._folder_from_json(res.json())

    def list_folders(self, owner_id: str) -> list[StoredFolderRecord]:
        q_equal = json.dumps({"method": "equal", "attribute": "owner_id", "values": [owner_id]})
        q_order = json.dumps({"method": "orderDesc", "attribute": "updated_at"})
        rows = self._list_all_rows(self.folders_col, [q_equal, q_order])
        folders = [self._folder_from_json(d) for d in rows]
        folders.sort(key=lambda f: f.name.lower())
        return folders

    def update_folder(
        self, folder_id: str, name: str, parent_id: str | None, updated_at: float
    ) -> None:
        url = f"{self._rows_url(self.folders_col)}/{folder_id}"
        payload = {
            "data": {
                "name": name,
                "parent_id": parent_id or "",
                "updated_at": updated_at,
            }
        }
        with httpx.Client(timeout=15.0) as client:
            res = client.patch(url, headers=self._headers(), json=payload)
        res.raise_for_status()

    def delete_folder(self, folder_id: str) -> None:
        url = f"{self._rows_url(self.folders_col)}/{folder_id}"
        with httpx.Client(timeout=15.0) as client:
            client.delete(url, headers=self._headers())

    def create_asset(self, record: StoredAssetRecord) -> None:
        payload = {
            "rowId": record.asset_id,
            "data": {
                "owner_id": record.owner_id,
                "kind": record.kind,
                "name": record.name,
                "mime_type": record.mime_type,
                "file_id": record.file_id,
                "width": record.width,
                "height": record.height,
                "created_at": record.created_at,
                "size_bytes": record.size_bytes,
            },
        }
        self._post_row_with_optional_size(self.assets_col, payload)

    def get_asset(self, asset_id: str) -> StoredAssetRecord | None:
        url = f"{self._rows_url(self.assets_col)}/{asset_id}"
        with httpx.Client(timeout=15.0) as client:
            res = client.get(url, headers=self._headers())
        if res.status_code == 404:
            return None
        res.raise_for_status()
        return self._asset_from_json(res.json())

    def list_assets(self, owner_id: str, kind: str | None = None) -> list[StoredAssetRecord]:
        queries = [
            json.dumps({"method": "equal", "attribute": "owner_id", "values": [owner_id]}),
            json.dumps({"method": "orderDesc", "attribute": "created_at"}),
        ]
        if kind:
            queries.append(json.dumps({"method": "equal", "attribute": "kind", "values": [kind]}))
        rows = self._list_all_rows(self.assets_col, queries)
        return [self._asset_from_json(d) for d in rows]

    def delete_asset(self, asset_id: str) -> None:
        url = f"{self._rows_url(self.assets_col)}/{asset_id}"
        with httpx.Client(timeout=15.0) as client:
            client.delete(url, headers=self._headers())

    def get_storage_used_bytes(self, file_ids: list[str]) -> int:
        """Fetch file sizes for legacy rows lacking stored size_bytes, paginated cleanly."""
        if not file_ids:
            return 0
        wanted = set(file_ids)
        url = f"{self.endpoint}/storage/buckets/{self.bucket_id}/files"
        total = 0
        cursor: str | None = None
        page_size = 100
        try:
            with httpx.Client(timeout=15.0) as client:
                while wanted:
                    queries = [json.dumps({"method": "limit", "values": [page_size]})]
                    if cursor is not None:
                        queries.append(json.dumps({"method": "cursorAfter", "values": [cursor]}))
                    res = client.get(
                        url,
                        headers=self._headers(json_body=False),
                        params={"queries[]": queries},
                    )
                    res.raise_for_status()
                    files = res.json().get("files", [])
                    if not files:
                        break
                    for item in files:
                        fid = str(item.get("$id"))
                        if fid in wanted:
                            total += int(item.get("sizeOriginal", 0))
                            wanted.discard(fid)
                    if len(files) < page_size:
                        break
                    cursor = str(files[-1]["$id"])
            return total
        except Exception:
            return 0


def create_repository(settings: Settings, fallback_root: Path) -> WorkspaceRepository:
    if settings.use_appwrite_storage:
        return AppwriteWorkspaceRepository(settings)
    return SqliteWorkspaceRepository(fallback_root)
