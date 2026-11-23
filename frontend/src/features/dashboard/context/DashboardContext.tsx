import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type React from "react";
import { useEditor } from "@/features/editor/context/EditorContext";
import { useWorkspace } from "@/features/workspace/context/WorkspaceContext";
import { useWindowKeyDown } from "@/hooks/useKeyboardShortcuts";
import { useWindowFileDrop } from "@/hooks/useWindowFileDrop";
import { isEditableTarget } from "@/lib/dom";
import type { DocumentListItem, FolderItem } from "@/types";
import {
  buildBreadcrumbs,
  buildFolderCounts,
  buildFolderMap,
  buildFolderTreeRows,
  filterVisibleDocs,
  filterVisibleFolders,
} from "../utils/selectors";
import type {
  ContextMenuState,
  ContextMenuTarget,
  DashboardContextValue,
  DriveSection,
  ViewMode,
} from "../types";

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const workspace = useWorkspace();
  const { upload, chooseFile, deleteDocument } = useEditor();

  const [section, setSection] = useState<DriveSection>(() =>
    workspace.currentFolderId ? "drive" : "home",
  );
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [search, setSearch] = useState("");
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

  const folderMap = useMemo(
    () => buildFolderMap(workspace.folders),
    [workspace.folders],
  );
  const activeFolderId =
    workspace.currentFolderId && folderMap.has(workspace.currentFolderId)
      ? workspace.currentFolderId
      : null;
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
    onDropFiles: (files) =>
      void upload.handleUploadFiles(files, uploadTargetFolderId),
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
      setContextMenu(null);
      chooseFile(uploadTargetFolderId);
    } else if (keyLower === "g") {
      e.preventDefault();
      setViewMode((m) => (m === "grid" ? "list" : "grid"));
    } else if (keyLower === "r") {
      e.preventDefault();
      void workspace.refreshWorkspace(true);
    } else if (e.key === "Backspace" && section === "drive" && activeFolderId) {
      e.preventDefault();
      workspace.setCurrentFolderId(
        folderMap.get(activeFolderId)?.parent_id ?? null,
      );
    }
  });

  const openFolder = (folderId: string) => {
    setSearch("");
    setSection("drive");
    workspace.setCurrentFolderId(folderId);
  };

  const openContextMenu = (e: React.MouseEvent, target: ContextMenuTarget) => {
    e.preventDefault();
    e.stopPropagation();
    const x = Math.min(e.clientX, Math.max(8, window.innerWidth - 224));
    const y = Math.min(e.clientY, Math.max(8, window.innerHeight - 228));
    setContextMenu({ ...target, x, y });
  };

  const folderCounts = useMemo(
    () => buildFolderCounts(workspace.folders, workspace.savedDocs),
    [workspace.folders, workspace.savedDocs],
  );
  const folderTreeRows = useMemo(
    () => buildFolderTreeRows(workspace.folders, folderMap),
    [workspace.folders, folderMap],
  );
  const query = search.trim().toLowerCase();
  const visibleFolders = useMemo(
    () => filterVisibleFolders(workspace.folders, folderMap, section, activeFolderId, query),
    [activeFolderId, folderMap, query, section, workspace.folders],
  );
  const visibleDocs = useMemo(
    () => filterVisibleDocs(workspace.savedDocs, folderMap, section, activeFolderId, query),
    [activeFolderId, folderMap, query, section, workspace.savedDocs],
  );
  const sharedCount = useMemo(
    () => workspace.savedDocs.filter((d) => d.is_shared).length,
    [workspace.savedDocs],
  );

  const usedBytes = workspace.storageUsage?.used_bytes ?? 0;
  const quotaBytes = workspace.storageUsage?.quota_bytes ?? 2_000_000_000;
  const usedPct = Math.min(100, quotaBytes > 0 ? (usedBytes / quotaBytes) * 100 : 0);
  const progressBarColor =
    usedPct >= 95 ? "bg-destructive" : usedPct >= 80 ? "bg-warning" : "bg-brand";

  const submitNewFolder = async () => {
    const trimmed = newFolderName.trim();
    if (!trimmed || creatingFolder) return;
    setCreatingFolder(true);
    try {
      await workspace.handleCreateFolder(trimmed, newFolderParentId);
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
      await workspace.handleRenameFolder(
        renameTarget.folder_id,
        renameValue.trim(),
      );
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
      await workspace.handleMoveDocToFolder(moveTarget.doc_id, targetFolderId);
      setMoveTarget(null);
    } finally {
      setMovingTargetId(null);
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    setContextMenu(null);
    setBusyItemId(folderId);
    try {
      await workspace.handleDeleteFolder(folderId);
    } finally {
      setBusyItemId(null);
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    setContextMenu(null);
    setBusyItemId(docId);
    try {
      await deleteDocument(docId);
    } finally {
      setBusyItemId(null);
    }
  };

  const newFolderParentLabel =
    newFolderParentId && folderMap.has(newFolderParentId)
      ? folderMap.get(newFolderParentId)!.name
      : "My Drive";

  return (
    <DashboardContext
      value={{
        section, setSection, viewMode, setViewMode, search, setSearch, query,
        mobileNavOpen, setMobileNavOpen, contextMenu, setContextMenu,
        searchInputRef, newFolderOpen, setNewFolderOpen,
        newFolderName, setNewFolderName, creatingFolder, newFolderParentLabel,
        renameTarget, setRenameTarget, renameValue, setRenameValue, renaming,
        moveTarget, setMoveTarget, movingTargetId, busyItemId,
        folderMap, activeFolderId, breadcrumbs, activeFolderName,
        uploadTargetFolderId, uploadTargetLabel, pageDragging,
        folderCounts, folderTreeRows, visibleFolders, visibleDocs, sharedCount,
        usedBytes, quotaBytes, usedPct, progressBarColor,
        openFolder, openContextMenu, openNewFolderDialog,
        submitNewFolder, submitRenameFolder, handleMoveDoc,
        handleDeleteFolder, handleDeleteDoc,
      }}
    >
      {children}
    </DashboardContext>
  );
}

export function useDashboard(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx) {
    throw new Error("useDashboard must be used within DashboardProvider");
  }
  return ctx;
}
