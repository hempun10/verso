import { useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { useWindowKeyDown } from "@/hooks/useKeyboardShortcuts";
import { useWindowFileDrop } from "@/hooks/useWindowFileDrop";
import { isEditableTarget } from "@/lib/dom";
import type { DocumentListItem, FolderItem, StorageUsage } from "@/types";
import {
  buildBreadcrumbs,
  buildFolderCounts,
  buildFolderMap,
  buildFolderTreeRows,
  filterVisibleDocs,
  filterVisibleFolders,
} from "./selectors";
import type {
  ContextMenuState,
  ContextMenuTarget,
  DriveSection,
  ViewMode,
} from "./types";

interface UseDashboardStateArgs {
  documents: DocumentListItem[];
  folders: FolderItem[];
  storageUsage: StorageUsage | null;
  currentFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onChooseFile: (folderId: string | null) => void;
  onUploadFiles: (files: File[], folderId: string | null) => void;
  onDeleteDocument: (docId: string) => Promise<void>;
  onMoveDocument: (docId: string, folderId: string | null) => Promise<void>;
  onCreateFolder: (name: string, parentId: string | null) => Promise<void>;
  onRenameFolder: (folderId: string, name: string) => Promise<void>;
  onDeleteFolder: (folderId: string) => Promise<void>;
  onRefresh: () => void;
}

export function useDashboardState({
  documents,
  folders,
  storageUsage,
  currentFolderId,
  onSelectFolder,
  onChooseFile,
  onUploadFiles,
  onDeleteDocument,
  onMoveDocument,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onRefresh,
}: UseDashboardStateArgs) {
  const [section, setSection] = useState<DriveSection>(() =>
    currentFolderId ? "drive" : "home",
  );
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [search, setSearch] = useState("");
  const [driveTreeExpanded, setDriveTreeExpanded] = useState(true);
  const [suggestedFoldersOpen, setSuggestedFoldersOpen] = useState(true);
  const [suggestedFilesOpen, setSuggestedFilesOpen] = useState(true);
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderParentId, setNewFolderParentId] = useState<string | null>(
    null,
  );
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [renameTarget, setRenameTarget] = useState<FolderItem | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [moveTarget, setMoveTarget] = useState<DocumentListItem | null>(null);
  const [movingTargetId, setMovingTargetId] = useState<string | null>(null);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);

  const folderMap = useMemo(() => buildFolderMap(folders), [folders]);
  const activeFolderId =
    currentFolderId && folderMap.has(currentFolderId) ? currentFolderId : null;
  const breadcrumbs = useMemo(
    () => buildBreadcrumbs(activeFolderId, folderMap),
    [activeFolderId, folderMap],
  );
  const activeFolderName =
    breadcrumbs.length > 0
      ? breadcrumbs[breadcrumbs.length - 1]!.name
      : "My Drive";

  const uploadTargetFolderId = section === "drive" ? activeFolderId : null;
  const uploadTargetLabel =
    uploadTargetFolderId && folderMap.has(uploadTargetFolderId)
      ? folderMap.get(uploadTargetFolderId)!.name
      : "My Drive";

  const pageDragging = useWindowFileDrop({
    onDropFiles: (files) => onUploadFiles(files, uploadTargetFolderId),
  });

  useEffect(() => {
    if (!contextMenu) return;
    const closeMenu = () => setContextMenu(null);
    window.addEventListener("click", closeMenu);
    window.addEventListener("scroll", closeMenu, true);
    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
    };
  }, [contextMenu]);

  const openNewFolderDialog = (parentId: string | null) => {
    setNewFolderParentId(parentId);
    setNewFolderName("");
    setNewFolderOpen(true);
    setNewMenuOpen(false);
    setContextMenu(null);
  };

  useWindowKeyDown((e) => {
    const mod = e.metaKey || e.ctrlKey;
    const keyLower = e.key.toLowerCase();
    if (mod && keyLower === "k") {
      e.preventDefault();
      searchInputRef.current?.focus();
      return;
    }
    if (e.key === "Escape") {
      setContextMenu(null);
      return;
    }
    if (isEditableTarget(e.target) || mod || e.altKey) return;
    if (newFolderOpen || renameTarget || moveTarget) return;

    if (e.key === "/") {
      e.preventDefault();
      searchInputRef.current?.focus();
    } else if (keyLower === "n") {
      e.preventDefault();
      openNewFolderDialog(uploadTargetFolderId);
    } else if (keyLower === "u") {
      e.preventDefault();
      setNewMenuOpen(false);
      setContextMenu(null);
      onChooseFile(uploadTargetFolderId);
    } else if (keyLower === "g") {
      e.preventDefault();
      setViewMode((m) => (m === "grid" ? "list" : "grid"));
    } else if (keyLower === "r") {
      e.preventDefault();
      onRefresh();
    } else if (e.key === "Backspace" && section === "drive" && activeFolderId) {
      e.preventDefault();
      onSelectFolder(folderMap.get(activeFolderId)?.parent_id ?? null);
    }
  });

  const openContextMenu = (e: React.MouseEvent, target: ContextMenuTarget) => {
    e.preventDefault();
    e.stopPropagation();
    const x = Math.min(e.clientX, Math.max(8, window.innerWidth - 224));
    const y = Math.min(e.clientY, Math.max(8, window.innerHeight - 228));
    setContextMenu({ ...target, x, y });
  };

  const folderCounts = useMemo(
    () => buildFolderCounts(folders, documents),
    [documents, folders],
  );
  const folderTreeRows = useMemo(
    () => buildFolderTreeRows(folders, folderMap),
    [folders, folderMap],
  );
  const query = search.trim().toLowerCase();
  const visibleFolders = useMemo(
    () => filterVisibleFolders(folders, folderMap, section, activeFolderId, query),
    [activeFolderId, folderMap, folders, query, section],
  );
  const visibleDocs = useMemo(
    () => filterVisibleDocs(documents, folderMap, section, activeFolderId, query),
    [activeFolderId, documents, folderMap, query, section],
  );
  const sharedCount = useMemo(
    () => documents.filter((d) => d.is_shared).length,
    [documents],
  );

  const usedBytes = storageUsage?.used_bytes ?? 0;
  const quotaBytes = storageUsage?.quota_bytes ?? 2_000_000_000;
  const usedPct = Math.min(
    100,
    quotaBytes > 0 ? (usedBytes / quotaBytes) * 100 : 0,
  );
  const progressBarColor =
    usedPct >= 95
      ? "bg-[#e0705f]"
      : usedPct >= 80
        ? "bg-[#f2b53d]"
        : "bg-[#7170ff]";

  const submitNewFolder = async () => {
    const trimmed = newFolderName.trim();
    if (!trimmed || creatingFolder) return;
    setCreatingFolder(true);
    try {
      await onCreateFolder(trimmed, newFolderParentId);
      setNewFolderName("");
      setNewFolderOpen(false);
    } finally {
      setCreatingFolder(false);
    }
  };

  const submitRenameFolder = async () => {
    if (!renameTarget || !renameValue.trim() || renaming) return;
    setRenaming(true);
    try {
      await onRenameFolder(renameTarget.folder_id, renameValue.trim());
      setRenameTarget(null);
      setRenameValue("");
    } finally {
      setRenaming(false);
    }
  };

  const handleMoveDoc = async (targetFolderId: string | null) => {
    if (!moveTarget || movingTargetId !== null) return;
    setMovingTargetId(targetFolderId ?? "__root__");
    try {
      await onMoveDocument(moveTarget.doc_id, targetFolderId);
      setMoveTarget(null);
    } finally {
      setMovingTargetId(null);
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    setContextMenu(null);
    setBusyItemId(folderId);
    try {
      await onDeleteFolder(folderId);
    } finally {
      setBusyItemId(null);
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    setContextMenu(null);
    setBusyItemId(docId);
    try {
      await onDeleteDocument(docId);
    } finally {
      setBusyItemId(null);
    }
  };

  const newFolderParentLabel =
    newFolderParentId && folderMap.has(newFolderParentId)
      ? folderMap.get(newFolderParentId)!.name
      : "My Drive";

  return {
    section, setSection, viewMode, setViewMode, search, setSearch, query,
    driveTreeExpanded, setDriveTreeExpanded,
    suggestedFoldersOpen, setSuggestedFoldersOpen,
    suggestedFilesOpen, setSuggestedFilesOpen,
    newMenuOpen, setNewMenuOpen, mobileNavOpen, setMobileNavOpen,
    contextMenu, setContextMenu, searchInputRef,
    newFolderOpen, setNewFolderOpen, newFolderName, setNewFolderName,
    creatingFolder, newFolderParentLabel,
    renameTarget, setRenameTarget, renameValue, setRenameValue, renaming,
    moveTarget, setMoveTarget, movingTargetId, busyItemId,
    folderMap, activeFolderId, breadcrumbs, activeFolderName,
    uploadTargetFolderId, uploadTargetLabel, pageDragging,
    folderCounts, folderTreeRows, visibleFolders, visibleDocs, sharedCount,
    usedBytes, quotaBytes, usedPct, progressBarColor,
    openContextMenu, openNewFolderDialog,
    submitNewFolder, submitRenameFolder, handleMoveDoc,
    handleDeleteFolder, handleDeleteDoc,
  };
}
