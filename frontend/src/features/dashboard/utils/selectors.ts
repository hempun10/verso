import type { DocumentListItem, FolderItem } from "@/types";
import type { DriveSection, FolderCounts, FolderTreeRow } from "../types";

export function buildFolderMap(folders: FolderItem[]): Map<string, FolderItem> {
  const map = new Map<string, FolderItem>();
  for (const f of folders) map.set(f.folder_id, f);
  return map;
}

export function buildBreadcrumbs(
  activeFolderId: string | null,
  folderMap: Map<string, FolderItem>,
): FolderItem[] {
  const trail: FolderItem[] = [];
  let cursor = activeFolderId;
  const seen = new Set<string>();
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    const item = folderMap.get(cursor);
    if (!item) break;
    trail.unshift(item);
    cursor = item.parent_id;
  }
  return trail;
}

export function buildFolderCounts(
  folders: FolderItem[],
  documents: DocumentListItem[],
): Map<string, FolderCounts> {
  const counts = new Map<string, FolderCounts>();
  for (const f of folders) counts.set(f.folder_id, { files: 0, subfolders: 0 });
  for (const f of folders) {
    if (f.parent_id && counts.has(f.parent_id)) {
      counts.get(f.parent_id)!.subfolders += 1;
    }
  }
  for (const d of documents) {
    if (d.folder_id && counts.has(d.folder_id)) {
      counts.get(d.folder_id)!.files += 1;
    }
  }
  return counts;
}

export function buildFolderTreeRows(
  folders: FolderItem[],
  folderMap: Map<string, FolderItem>,
): FolderTreeRow[] {
  const rows: FolderTreeRow[] = [];
  const byParent = new Map<string | null, FolderItem[]>();
  for (const f of folders) {
    const key = f.parent_id && folderMap.has(f.parent_id) ? f.parent_id : null;
    const list = byParent.get(key) ?? [];
    list.push(f);
    byParent.set(key, list);
  }
  const visit = (parentId: string | null, depth: number, prefix: string) => {
    const children = (byParent.get(parentId) ?? []).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    for (const child of children) {
      const pathLabel = prefix ? `${prefix} / ${child.name}` : child.name;
      rows.push({ folder: child, depth, pathLabel });
      if (depth < 6) visit(child.folder_id, depth + 1, pathLabel);
    }
  };
  visit(null, 0, "");
  return rows;
}

export function filterVisibleFolders(
  folders: FolderItem[],
  folderMap: Map<string, FolderItem>,
  section: DriveSection,
  activeFolderId: string | null,
  query: string,
): FolderItem[] {
  if (query) return folders.filter((f) => f.name.toLowerCase().includes(query));
  if (section === "home") {
    return [...folders].sort((a, b) => b.updated_at - a.updated_at).slice(0, 8);
  }
  if (section !== "drive") return [];
  return folders.filter((f) => {
    const parent =
      f.parent_id && folderMap.has(f.parent_id) ? f.parent_id : null;
    return parent === activeFolderId;
  });
}

export function filterVisibleDocs(
  documents: DocumentListItem[],
  folderMap: Map<string, FolderItem>,
  section: DriveSection,
  activeFolderId: string | null,
  query: string,
): DocumentListItem[] {
  let base = documents;
  if (section === "shared") {
    base = base.filter((d) => d.is_shared);
  } else if (section === "drive" && !query) {
    base = base.filter((d) => {
      const folderId =
        d.folder_id && folderMap.has(d.folder_id) ? d.folder_id : null;
      return folderId === activeFolderId;
    });
  }
  if (query) {
    base = base.filter((d) => d.filename.toLowerCase().includes(query));
  }
  return base;
}
