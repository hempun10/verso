"""Bootstrap Appwrite TablesDB Database, Tables, Columns, Indexes, and Storage Bucket.

Usage:
    cd backend
    cp .env.example .env  # fill in APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY
    uv run python scripts/setup_appwrite.py
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from editpdf.config import load_settings


def _exists(client: httpx.Client, get_url: str) -> bool:
    res = client.get(get_url)
    return res.status_code == 200


def _ensure_resource(
    client: httpx.Client,
    get_url: str,
    post_url: str,
    payload: dict,
    label: str,
) -> None:
    if _exists(client, get_url):
        print(f"  OK (already exists): {label}")
        return
    res = client.post(post_url, json=payload)
    if res.status_code in (200, 201, 202, 409):
        status = "already exists" if res.status_code == 409 else "created"
        print(f"  OK ({status}): {label}")
        return
    raise RuntimeError(f"Appwrite error {res.status_code} on {post_url}: {res.text}")


def _post_ignore_exists(client: httpx.Client, url: str, payload: dict) -> None:
    res = client.post(url, json=payload)
    if res.status_code in (200, 201, 202, 409):
        status = "already exists" if res.status_code == 409 else "created"
        name = payload.get("key") or payload.get("name") or url.rsplit("/", 1)[-1]
        print(f"  OK ({status}): {url.split('/v1')[-1]} -> {name}")
        return
    raise RuntimeError(f"Appwrite error {res.status_code} on {url}: {res.text}")


def _wait_for_columns(
    client: httpx.Client,
    table_url: str,
    required_keys: list[str],
    timeout_s: float = 30.0,
) -> None:
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        res = client.get(f"{table_url}/columns")
        if res.status_code == 200:
            cols = res.json().get("columns", [])
            statuses = {c["key"]: c.get("status") for c in cols}
            if all(statuses.get(k) == "available" for k in required_keys):
                return
        time.sleep(0.6)
    print(f"  WARN: timed out waiting for columns {required_keys}; attempting index anyway")


def main() -> None:
    s = load_settings()
    if not s.use_appwrite_storage:
        raise SystemExit(
            "Set APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, and APPWRITE_API_KEY in backend/.env first."
        )

    headers = {
        "X-Appwrite-Project": s.appwrite_project_id,
        "X-Appwrite-Key": s.appwrite_api_key,
        "Content-Type": "application/json",
    }

    with httpx.Client(headers=headers, timeout=20.0) as client:
        base = s.appwrite_endpoint
        print(f"Bootstrapping Appwrite project {s.appwrite_project_id} at {base}...")

        # 1. Database (TablesDB)
        _ensure_resource(
            client,
            f"{base}/tablesdb/{s.appwrite_database_id}",
            f"{base}/tablesdb",
            {"databaseId": s.appwrite_database_id, "name": "EditPDF"},
            f"database/{s.appwrite_database_id}",
        )

        # 2. Documents table
        tables_url = f"{base}/tablesdb/{s.appwrite_database_id}/tables"
        doc_table_url = f"{tables_url}/{s.appwrite_documents_collection_id}"
        _ensure_resource(
            client,
            doc_table_url,
            tables_url,
            {
                "tableId": s.appwrite_documents_collection_id,
                "name": "Documents",
                "rowSecurity": False,
            },
            f"table/{s.appwrite_documents_collection_id}",
        )
        doc_col = f"{doc_table_url}/columns"
        for key, size, required in [
            ("owner_id", 64, True),
            ("filename", 255, True),
            ("file_id", 64, True),
            ("pages_json", 65535, True),
            ("edits_json", 1000000, False),
            ("overlays_json", 1000000, False),
            ("share_token", 64, False),
            ("updated_by", 128, False),
            ("folder_id", 64, False),
        ]:
            _post_ignore_exists(
                client,
                f"{doc_col}/string",
                {"key": key, "size": size, "required": required},
            )
        _post_ignore_exists(
            client,
            f"{doc_col}/boolean",
            {"key": "is_shared", "required": False, "default": False},
        )
        _post_ignore_exists(
            client,
            f"{doc_col}/integer",
            {"key": "version", "required": False, "default": 1},
        )
        _post_ignore_exists(
            client,
            f"{doc_col}/integer",
            {"key": "size_bytes", "required": False, "default": 0},
        )
        for key in ("created_at", "updated_at"):
            _post_ignore_exists(
                client,
                f"{doc_col}/float",
                {"key": key, "required": True},
            )
        _wait_for_columns(client, doc_table_url, ["owner_id", "updated_at"])
        _post_ignore_exists(
            client,
            f"{doc_table_url}/indexes",
            {
                "key": "idx_owner_updated",
                "type": "key",
                "columns": ["owner_id", "updated_at"],
                "orders": ["ASC", "DESC"],
            },
        )

        # 3. Assets table (saved signatures & uploaded images)
        asset_table_url = f"{tables_url}/{s.appwrite_assets_collection_id}"
        _ensure_resource(
            client,
            asset_table_url,
            tables_url,
            {
                "tableId": s.appwrite_assets_collection_id,
                "name": "Assets",
                "rowSecurity": False,
            },
            f"table/{s.appwrite_assets_collection_id}",
        )
        asset_col = f"{asset_table_url}/columns"
        for key, size, required in [
            ("owner_id", 64, True),
            ("kind", 24, True),
            ("name", 128, True),
            ("mime_type", 64, True),
            ("file_id", 64, True),
        ]:
            _post_ignore_exists(
                client,
                f"{asset_col}/string",
                {"key": key, "size": size, "required": required},
            )
        for key in ("width", "height"):
            _post_ignore_exists(
                client,
                f"{asset_col}/integer",
                {"key": key, "required": True},
            )
        _post_ignore_exists(
            client,
            f"{asset_col}/integer",
            {"key": "size_bytes", "required": False, "default": 0},
        )
        _post_ignore_exists(
            client,
            f"{asset_col}/float",
            {"key": "created_at", "required": True},
        )
        _wait_for_columns(client, asset_table_url, ["owner_id", "kind", "created_at"])
        _post_ignore_exists(
            client,
            f"{asset_table_url}/indexes",
            {
                "key": "idx_asset_owner_kind",
                "type": "key",
                "columns": ["owner_id", "kind", "created_at"],
                "orders": ["ASC", "ASC", "DESC"],
            },
        )

        # 3b. Folders table (Google Drive–style folders for organizing PDFs)
        folder_table_url = f"{tables_url}/{s.appwrite_folders_collection_id}"
        _ensure_resource(
            client,
            folder_table_url,
            tables_url,
            {
                "tableId": s.appwrite_folders_collection_id,
                "name": "Folders",
                "rowSecurity": False,
            },
            f"table/{s.appwrite_folders_collection_id}",
        )
        folder_col = f"{folder_table_url}/columns"
        for key, size, required in [
            ("owner_id", 64, True),
            ("name", 128, True),
            ("parent_id", 64, False),
        ]:
            _post_ignore_exists(
                client,
                f"{folder_col}/string",
                {"key": key, "size": size, "required": required},
            )
        for key in ("created_at", "updated_at"):
            _post_ignore_exists(
                client,
                f"{folder_col}/float",
                {"key": key, "required": True},
            )
        _wait_for_columns(client, folder_table_url, ["owner_id", "updated_at"])
        _post_ignore_exists(
            client,
            f"{folder_table_url}/indexes",
            {
                "key": "idx_folder_owner",
                "type": "key",
                "columns": ["owner_id", "updated_at"],
                "orders": ["ASC", "DESC"],
            },
        )

        # 4. Storage bucket for PDFs, signatures, and images
        _ensure_resource(
            client,
            f"{base}/storage/buckets/{s.appwrite_bucket_id}",
            f"{base}/storage/buckets",
            {
                "bucketId": s.appwrite_bucket_id,
                "name": "EditPDF Files",
                "fileSecurity": False,
                "maximumFileSize": 50000000,
                "allowedFileExtensions": ["pdf", "png", "jpg", "jpeg", "webp"],
            },
            f"bucket/{s.appwrite_bucket_id}",
        )

    print("Appwrite setup complete!")


if __name__ == "__main__":
    main()
