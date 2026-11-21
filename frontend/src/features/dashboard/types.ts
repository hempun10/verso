import type React from "react";
import type { DocumentListItem, FolderItem } from "@/types";

export type DriveSection = "home" | "drive" | "recent" | "shared" | "storage";
export type ViewMode = "grid" | "list";

export type ContextMenuTarget =
  | { kind: "canvas" }
  | { kind: "folder"; folder: FolderItem }
  | { kind: "file"; doc: DocumentListItem };

export type ContextMenuState = ContextMenuTarget & { x: number; y: number };

export interface FolderTreeRow {
  folder: FolderItem;
  depth: number;
  pathLabel: string;
}

export interface FolderCounts {
  files: number;
  subfolders: number;
}

export interface DashboardContextValue {
  section: DriveSection;
  setSection: (s: DriveSection) => void;
  viewMode: ViewMode;
  setViewMode: (m: ViewMode) => void;
  search: string;
  setSearch: (q: string) => void;
  query: string;
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
  contextMenu: ContextMenuState | null;
  setContextMenu: (m: ContextMenuState | null) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  newFolderOpen: boolean;
  setNewFolderOpen: (open: boolean) => void;
  newFolderName: string;
  setNewFolderName: (v: string) => void;
  creatingFolder: boolean;
  newFolderParentLabel: string;
  renameTarget: FolderItem | null;
  setRenameTarget: (f: FolderItem | null) => void;
  renameValue: string;
  setRenameValue: (v: string) => void;
  renaming: boolean;
  moveTarget: DocumentListItem | null;
  setMoveTarget: (d: DocumentListItem | null) => void;
  movingTargetId: string | null;
  busyItemId: string | null;
  folderMap: Map<string, FolderItem>;
  activeFolderId: string | null;
  breadcrumbs: FolderItem[];
  activeFolderName: string;
  uploadTargetFolderId: string | null;
  uploadTargetLabel: string;
  pageDragging: boolean;
  folderCounts: Map<string, FolderCounts>;
  folderTreeRows: FolderTreeRow[];
  visibleFolders: FolderItem[];
  visibleDocs: DocumentListItem[];
  sharedCount: number;
  usedBytes: number;
  quotaBytes: number;
  usedPct: number;
  progressBarColor: string;
  openFolder: (folderId: string) => void;
  openContextMenu: (e: React.MouseEvent, target: ContextMenuTarget) => void;
  openNewFolderDialog: (parentId: string | null) => void;
  submitNewFolder: () => Promise<void>;
  submitRenameFolder: () => Promise<void>;
  handleMoveDoc: (targetFolderId: string | null) => Promise<void>;
  handleDeleteFolder: (folderId: string) => Promise<void>;
  handleDeleteDoc: (docId: string) => Promise<void>;
}
