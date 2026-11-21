import { apiFetch, ensureOk } from "@/api/client";
import type { FolderItem, StorageUsage } from "@/types";

export async function listFolders() {
  const res = await ensureOk(await apiFetch("/api/folders"));
  return (await res.json()) as FolderItem[];
}

export async function createFolder(name: string, parentId?: string | null) {
  const res = await ensureOk(
    await apiFetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, parent_id: parentId ?? null }),
    }),
  );
  return (await res.json()) as FolderItem;
}

export async function updateFolder(
  folderId: string,
  patch: { name?: string; parent_id?: string | null; move_parent?: boolean },
) {
  const res = await ensureOk(
    await apiFetch(`/api/folders/${folderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }),
  );
  return (await res.json()) as FolderItem;
}

export async function deleteFolder(folderId: string) {
  await ensureOk(await apiFetch(`/api/folders/${folderId}`, { method: "DELETE" }));
}

export async function fetchStorageUsage() {
  const res = await ensureOk(await apiFetch("/api/storage"));
  return (await res.json()) as StorageUsage;
}
