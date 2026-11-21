import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Cloud,
  FileText,
  Folder,
  FolderInput,
  FolderOpen,
  FolderPlus,
  HardDrive,
  Home,
  Image as ImageIcon,
  Keyboard,
  LayoutGrid,
  List,
  Loader2,
  LogOut,
  Menu,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Share2,
  Trash2,
  Upload,
  User as UserIcon,
  X,
} from "lucide-react";
import { BRAND_NAME, BrandLogo } from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileDropOverlay } from "@/components/ui/file-drop-overlay";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { useWindowKeyDown } from "@/hooks/useKeyboardShortcuts";
import { useWindowFileDrop } from "@/hooks/useWindowFileDrop";
import { isEditableTarget } from "@/lib/dom";
import { formatBytes, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  formatFileSize,
  isImageFilename,
  MAX_BATCH_UPLOAD_FILES,
} from "@/lib/validation";
import type {
  DocumentListItem,
  FolderItem,
  StorageUsage,
  UploadLimits,
  UserInfo,
} from "@/types";

type DriveSection = "home" | "drive" | "recent" | "shared" | "storage";
type ViewMode = "grid" | "list";

type ContextMenuTarget =
  | { kind: "canvas" }
  | { kind: "folder"; folder: FolderItem }
  | { kind: "file"; doc: DocumentListItem };

type ContextMenuState = ContextMenuTarget & { x: number; y: number };

interface DashboardPageProps {
  documents: DocumentListItem[];
  folders: FolderItem[];
  storageUsage: StorageUsage | null;
  loading: boolean;
  authLoading: boolean;
  isSignedIn: boolean;
  user: UserInfo | null;
  uploadLimits: UploadLimits;
  currentFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onOpenDocument: (docId: string) => void;
  onChooseFile: (folderId: string | null) => void;
  onUploadFiles: (files: File[], folderId: string | null) => void;
  onDeleteDocument: (docId: string) => Promise<void>;
  onMoveDocument: (docId: string, folderId: string | null) => Promise<void>;
  onCreateFolder: (name: string, parentId: string | null) => Promise<void>;
  onRenameFolder: (folderId: string, name: string) => Promise<void>;
  onDeleteFolder: (folderId: string) => Promise<void>;
  onRefresh: () => void;
  onOpenAuth: () => void;
  onSignOut: () => void;
  onOpenShortcuts: () => void;
  onGoHome: () => void;
  error: string | null;
  onDismissError: () => void;
}

const formatStorageSize = formatBytes;

export function DashboardPage({
  documents,
  folders,
  storageUsage,
  loading,
  authLoading,
  isSignedIn,
  user,
  uploadLimits,
  currentFolderId,
  onSelectFolder,
  onOpenDocument,
  onChooseFile,
  onUploadFiles,
  onDeleteDocument,
  onMoveDocument,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onRefresh,
  onOpenAuth,
  onSignOut,
  onOpenShortcuts,
  onGoHome,
  error,
  onDismissError,
}: DashboardPageProps) {
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

  // Right-click custom context menu
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Dialog states
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

  const folderMap = useMemo(() => {
    const map = new Map<string, FolderItem>();
    for (const f of folders) map.set(f.folder_id, f);
    return map;
  }, [folders]);

  const activeFolderId =
    currentFolderId && folderMap.has(currentFolderId) ? currentFolderId : null;

  const breadcrumbs = useMemo(() => {
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
  }, [activeFolderId, folderMap]);

  const activeFolderName =
    breadcrumbs.length > 0
      ? breadcrumbs[breadcrumbs.length - 1]!.name
      : "My Drive";

  const uploadTargetFolderId = section === "drive" ? activeFolderId : null;
  const uploadTargetLabel =
    uploadTargetFolderId && folderMap.has(uploadTargetFolderId)
      ? folderMap.get(uploadTargetFolderId)!.name
      : "My Drive";

  // Whole-page OS file drag-and-drop (anywhere on the browser window)
  const pageDragging = useWindowFileDrop({
    onDropFiles: (files) => onUploadFiles(files, uploadTargetFolderId),
  });

  // Dismiss open context menu on outside click or scroll (only subscribed while open)
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

  // Dashboard keyboard shortcuts: ⌘K or / search, N new folder, U upload, G grid/list, R refresh, Backspace up folder
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
      setNewFolderParentId(uploadTargetFolderId);
      setNewFolderName("");
      setNewFolderOpen(true);
      setNewMenuOpen(false);
      setContextMenu(null);
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
    } else if (
      e.key === "Backspace" &&
      section === "drive" &&
      activeFolderId
    ) {
      e.preventDefault();
      const cur = folderMap.get(activeFolderId);
      onSelectFolder(cur?.parent_id ?? null);
    }
  });

  const openContextMenu = (e: React.MouseEvent, target: ContextMenuTarget) => {
    e.preventDefault();
    e.stopPropagation();
    const menuW = 216;
    const menuH = 220;
    const x = Math.min(e.clientX, Math.max(8, window.innerWidth - menuW - 8));
    const y = Math.min(e.clientY, Math.max(8, window.innerHeight - menuH - 8));
    setContextMenu({ ...target, x, y });
  };

  const openNewFolderDialog = (parentId: string | null) => {
    setNewFolderParentId(parentId);
    setNewFolderName("");
    setNewFolderOpen(true);
    setNewMenuOpen(false);
    setContextMenu(null);
  };

  // Count direct items inside each folder
  const folderCounts = useMemo(() => {
    const counts = new Map<string, { files: number; subfolders: number }>();
    for (const f of folders) {
      counts.set(f.folder_id, { files: 0, subfolders: 0 });
    }
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
  }, [documents, folders]);

  // Indented folder tree rows
  const folderTreeRows = useMemo(() => {
    const rows: { folder: FolderItem; depth: number; pathLabel: string }[] = [];
    const byParent = new Map<string | null, FolderItem[]>();
    for (const f of folders) {
      const key =
        f.parent_id && folderMap.has(f.parent_id) ? f.parent_id : null;
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
        if (depth < 6) {
          visit(child.folder_id, depth + 1, pathLabel);
        }
      }
    };
    visit(null, 0, "");
    return rows;
  }, [folders, folderMap]);

  const query = search.trim().toLowerCase();

  const visibleFolders = useMemo(() => {
    if (query) {
      return folders.filter((f) => f.name.toLowerCase().includes(query));
    }
    if (section === "home") {
      return [...folders]
        .sort((a, b) => b.updated_at - a.updated_at)
        .slice(0, 8);
    }
    if (section !== "drive") return [];
    return folders.filter((f) => {
      const normalizedParent =
        f.parent_id && folderMap.has(f.parent_id) ? f.parent_id : null;
      return normalizedParent === activeFolderId;
    });
  }, [activeFolderId, folderMap, folders, query, section]);

  const visibleDocs = useMemo(() => {
    let base = documents;
    if (section === "shared") {
      base = base.filter((d) => d.is_shared);
    } else if (section === "drive" && !query) {
      base = base.filter((d) => {
        const normalizedFolder =
          d.folder_id && folderMap.has(d.folder_id) ? d.folder_id : null;
        return normalizedFolder === activeFolderId;
      });
    }
    if (query) {
      base = base.filter((d) => d.filename.toLowerCase().includes(query));
    }
    return base;
  }, [activeFolderId, documents, folderMap, query, section]);

  const sharedCount = useMemo(
    () => documents.filter((d) => d.is_shared).length,
    [documents],
  );

  // Storage progress metrics
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

  const newFolderParentLabel =
    newFolderParentId && folderMap.has(newFolderParentId)
      ? folderMap.get(newFolderParentId)!.name
      : "My Drive";

  const renderSidebarContent = () => (
    <div className="flex h-full flex-col px-3 py-3.5">
      {/* Brand Header */}
      <div className="flex items-center justify-between px-2 pb-3.5">
        <button
          type="button"
          onClick={onGoHome}
          className="flex cursor-pointer items-center gap-2.5 text-[15px] font-semibold tracking-[-0.01em] text-[#f7f8f8] transition-opacity hover:opacity-85"
        >
          <BrandLogo size={24} />
          <span>{BRAND_NAME}</span>
        </button>
        {mobileNavOpen && (
          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close sidebar"
            className="rounded-md p-1 text-[#8a8f98] hover:bg-[#1c1d1f] hover:text-[#f7f8f8] md:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Google Drive–style "+ New" Pill Button with Popover Menu */}
      <div className="px-1 pb-4">
        <Popover open={newMenuOpen} onOpenChange={setNewMenuOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex h-10 cursor-pointer items-center gap-2.5 rounded-xl bg-white pr-5 pl-3.5 text-[13px] font-semibold text-[#08090a] shadow-[inset_0_-1px_0_rgba(0,0,0,0.14),0_2px_8px_rgba(0,0,0,0.45)] transition-[transform,background-color] duration-100 hover:bg-[#f4f4f6] active:scale-[0.98]"
            >
              <Plus className="h-4 w-4 stroke-[2.4]" />
              <span>New</span>
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            sideOffset={6}
            className="w-52 border-[#2a2b2f] bg-[#141516] p-1.5 text-[#f7f8f8] shadow-2xl"
          >
            <button
              type="button"
              onClick={() => openNewFolderDialog(uploadTargetFolderId)}
              className="flex w-full cursor-pointer items-center justify-between gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-[#f7f8f8] transition-colors hover:bg-[#1c1d1f]"
            >
              <span className="flex items-center gap-2.5">
                <FolderPlus className="h-4 w-4 text-[#7170ff]" />
                <span>New folder</span>
              </span>
              <kbd className="rounded border border-[#2a2b2f] bg-[#0f1011] px-1.5 py-0.5 font-mono text-[10px] text-[#62666d]">
                N
              </kbd>
            </button>
            <Separator className="my-1 bg-[#1f2023]" />
            <button
              type="button"
              onClick={() => {
                setNewMenuOpen(false);
                setMobileNavOpen(false);
                onChooseFile(uploadTargetFolderId);
              }}
              className="flex w-full cursor-pointer items-center justify-between gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-[#f7f8f8] transition-colors hover:bg-[#1c1d1f]"
            >
              <span className="flex items-center gap-2.5">
                <Upload className="h-4 w-4 text-[#a1a1aa]" />
                <span>File upload</span>
              </span>
              <kbd className="rounded border border-[#2a2b2f] bg-[#0f1011] px-1.5 py-0.5 font-mono text-[10px] text-[#62666d]">
                U
              </kbd>
            </button>
          </PopoverContent>
        </Popover>
      </div>

      {/* Primary Drive Navigation */}
      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto pr-0.5 [scrollbar-width:none]">
        <button
          type="button"
          onClick={() => {
            setSection("home");
            onSelectFolder(null);
            setMobileNavOpen(false);
          }}
          className={cn(
            "flex cursor-pointer items-center gap-2.5 rounded-full px-3 py-2 text-[13px] font-medium transition-colors",
            section === "home"
              ? "bg-[#7170ff]/18 text-[#f7f8f8]"
              : "text-[#a1a1aa] hover:bg-[#16171a] hover:text-[#f7f8f8]",
          )}
        >
          <Home
            className={cn(
              "h-4 w-4 shrink-0",
              section === "home" ? "text-[#7170ff]" : "text-[#8a8f98]",
            )}
          />
          <span>Home</span>
        </button>

        {/* My Drive + Expandable Folder Tree */}
        <div className="mt-1 flex flex-col gap-0.5">
          <div
            className={cn(
              "flex items-center rounded-full pr-3 pl-1.5 text-[13px] font-medium transition-colors",
              section === "drive" && activeFolderId === null
                ? "bg-[#7170ff]/18 text-[#f7f8f8]"
                : "text-[#a1a1aa] hover:bg-[#16171a] hover:text-[#f7f8f8]",
            )}
          >
            <button
              type="button"
              aria-label={
                driveTreeExpanded ? "Collapse folders" : "Expand folders"
              }
              onClick={() => setDriveTreeExpanded((v) => !v)}
              className="flex h-7 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full text-[#62666d] hover:text-[#f7f8f8]"
            >
              {folderTreeRows.length > 0 ? (
                driveTreeExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )
              ) : (
                <span className="w-3" />
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setSection("drive");
                onSelectFolder(null);
                setMobileNavOpen(false);
              }}
              className="flex flex-1 cursor-pointer items-center justify-between py-2 text-left"
            >
              <span className="flex items-center gap-2.5">
                <HardDrive
                  className={cn(
                    "h-4 w-4 shrink-0",
                    section === "drive" && activeFolderId === null
                      ? "text-[#7170ff]"
                      : "text-[#8a8f98]",
                  )}
                />
                <span>My Drive</span>
              </span>
              <span className="text-[11px] text-[#62666d] tabular-nums">
                {documents.length}
              </span>
            </button>
          </div>

          {driveTreeExpanded && folderTreeRows.length > 0 && (
            <div className="flex flex-col gap-0.5 py-0.5">
              {folderTreeRows.map(({ folder, depth }) => {
                const isActive =
                  section === "drive" && activeFolderId === folder.folder_id;
                const counts = folderCounts.get(folder.folder_id);
                return (
                  <button
                    key={folder.folder_id}
                    type="button"
                    onClick={() => {
                      setSection("drive");
                      onSelectFolder(folder.folder_id);
                      setMobileNavOpen(false);
                    }}
                    onContextMenu={(e) =>
                      openContextMenu(e, { kind: "folder", folder })
                    }
                    style={{ paddingLeft: `${26 + depth * 14}px` }}
                    className={cn(
                      "flex cursor-pointer items-center justify-between gap-2 rounded-full py-1.5 pr-3 text-left text-[12px] transition-colors",
                      isActive
                        ? "bg-[#7170ff]/18 font-medium text-[#f7f8f8]"
                        : "text-[#8a8f98] hover:bg-[#16171a] hover:text-[#f7f8f8]",
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Folder
                        className={cn(
                          "h-3.5 w-3.5 shrink-0",
                          isActive ? "text-[#7170ff]" : "text-[#62666d]",
                        )}
                      />
                      <span className="truncate">{folder.name}</span>
                    </span>
                    {counts && counts.files > 0 && (
                      <span className="shrink-0 text-[10px] text-[#62666d] tabular-nums">
                        {counts.files}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <Separator className="my-2.5 bg-[#1a1b1e]" />

        <button
          type="button"
          onClick={() => {
            setSection("shared");
            setMobileNavOpen(false);
          }}
          className={cn(
            "flex cursor-pointer items-center justify-between rounded-full px-3 py-2 text-[13px] font-medium transition-colors",
            section === "shared"
              ? "bg-[#7170ff]/18 text-[#f7f8f8]"
              : "text-[#a1a1aa] hover:bg-[#16171a] hover:text-[#f7f8f8]",
          )}
        >
          <span className="flex items-center gap-2.5">
            <Share2
              className={cn(
                "h-4 w-4 shrink-0",
                section === "shared" ? "text-[#7170ff]" : "text-[#8a8f98]",
              )}
            />
            <span>Shared</span>
          </span>
          {sharedCount > 0 && (
            <span className="text-[11px] text-[#62666d] tabular-nums">
              {sharedCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setSection("recent");
            setMobileNavOpen(false);
          }}
          className={cn(
            "flex cursor-pointer items-center gap-2.5 rounded-full px-3 py-2 text-[13px] font-medium transition-colors",
            section === "recent"
              ? "bg-[#7170ff]/18 text-[#f7f8f8]"
              : "text-[#a1a1aa] hover:bg-[#16171a] hover:text-[#f7f8f8]",
          )}
        >
          <Clock
            className={cn(
              "h-4 w-4 shrink-0",
              section === "recent" ? "text-[#7170ff]" : "text-[#8a8f98]",
            )}
          />
          <span>Recent</span>
        </button>

        <Separator className="my-2.5 bg-[#1a1b1e]" />

        {/* Google Drive–Style Storage Row + Meter */}
        <button
          type="button"
          onClick={() => {
            setSection("storage");
            setMobileNavOpen(false);
          }}
          className={cn(
            "flex cursor-pointer items-center gap-2.5 rounded-full px-3 py-2 text-[13px] font-medium transition-colors",
            section === "storage"
              ? "bg-[#7170ff]/18 text-[#f7f8f8]"
              : "text-[#a1a1aa] hover:bg-[#16171a] hover:text-[#f7f8f8]",
          )}
        >
          <Cloud
            className={cn(
              "h-4 w-4 shrink-0",
              section === "storage" ? "text-[#7170ff]" : "text-[#8a8f98]",
            )}
          />
          <span>Storage</span>
        </button>

        <div className="mt-1 px-3 pt-1 pb-2" data-storage-widget="true">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#1f2023]">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                progressBarColor,
              )}
              style={{
                width: `${usedBytes > 0 ? Math.max(2, usedPct) : 0}%`,
              }}
            />
          </div>
          <p className="mt-2 text-[12px] text-[#a1a1aa] tabular-nums">
            {formatStorageSize(usedBytes)} of {formatStorageSize(quotaBytes)}{" "}
            used
          </p>
          <button
            type="button"
            onClick={() => {
              setSection("storage");
              setMobileNavOpen(false);
            }}
            className="mt-2.5 inline-flex h-8 w-full cursor-pointer items-center justify-center rounded-full border border-[#2a2b2f] bg-transparent text-[12px] font-medium text-[#7170ff] transition-colors hover:border-[#7170ff]/50 hover:bg-[#7170ff]/10"
          >
            Manage storage
          </button>
        </div>
      </nav>
    </div>
  );

  const renderFolderCards = (folderList: FolderItem[], compactPill = false) => {
    if (compactPill) {
      // Exact Google Drive "Suggested folders" compact pill grid
      return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {folderList.map((folder) => {
            const parentName =
              folder.parent_id && folderMap.has(folder.parent_id)
                ? folderMap.get(folder.parent_id)!.name
                : "My Drive";
            const isDeleting = busyItemId === folder.folder_id;
            return (
              <div
                key={folder.folder_id}
                onContextMenu={(e) =>
                  openContextMenu(e, { kind: "folder", folder })
                }
                className="group flex items-center justify-between gap-2 rounded-xl border border-[#1f2023] bg-[#141516] px-3.5 py-2.5 transition-colors hover:border-[#2a2b2f] hover:bg-[#1a1b1f]"
              >
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setSection("drive");
                    onSelectFolder(folder.folder_id);
                  }}
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
                >
                  <Folder className="h-4 w-4 shrink-0 text-[#a1a1aa] transition-colors group-hover:text-[#7170ff]" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-[#f7f8f8]">
                      {folder.name}
                    </div>
                    <div className="truncate text-[11px] text-[#62666d]">
                      in {parentName}
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  aria-label={`Folder options for ${folder.name}`}
                  disabled={isDeleting}
                  onClick={(e) =>
                    openContextMenu(e, { kind: "folder", folder })
                  }
                  className="cursor-pointer rounded-full p-1 text-[#62666d] transition-colors hover:bg-[#232428] hover:text-[#f7f8f8]"
                >
                  {isDeleting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <MoreVertical className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      );
    }

    return (
      <div
        className={cn(
          viewMode === "grid"
            ? "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
            : "divide-y divide-[#1f2023] overflow-hidden rounded-xl border border-[#1f2023] bg-[#141516]/60",
        )}
      >
        {folderList.map((folder) => {
          const counts = folderCounts.get(folder.folder_id) ?? {
            files: 0,
            subfolders: 0,
          };
          const isDeleting = busyItemId === folder.folder_id;
          const subtitle =
            counts.files === 0 && counts.subfolders === 0
              ? "Empty"
              : [
                  counts.files > 0
                    ? `${counts.files} ${counts.files === 1 ? "file" : "files"}`
                    : "",
                  counts.subfolders > 0
                    ? `${counts.subfolders} ${counts.subfolders === 1 ? "folder" : "folders"}`
                    : "",
                ]
                  .filter(Boolean)
                  .join(" · ");

          return (
            <div
              key={folder.folder_id}
              onContextMenu={(e) =>
                openContextMenu(e, { kind: "folder", folder })
              }
              className={cn(
                "group flex items-center justify-between gap-2 transition-colors",
                viewMode === "grid"
                  ? "rounded-xl border border-[#1f2023] bg-[#141516] px-3.5 py-2.5 hover:border-[#2a2b2f] hover:bg-[#1a1b1f]"
                  : "px-4 py-2.5 hover:bg-[#16171a]",
              )}
            >
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setSection("drive");
                  onSelectFolder(folder.folder_id);
                }}
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
              >
                <Folder className="h-4 w-4 shrink-0 text-[#7170ff]" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-[#f7f8f8]">
                    {folder.name}
                  </div>
                  <div className="text-[11px] text-[#62666d] tabular-nums">
                    {subtitle}
                  </div>
                </div>
              </button>
              <button
                type="button"
                aria-label={`Folder options for ${folder.name}`}
                disabled={isDeleting}
                onClick={(e) => openContextMenu(e, { kind: "folder", folder })}
                className="cursor-pointer rounded-full p-1 text-[#62666d] transition-colors hover:bg-[#232428] hover:text-[#f7f8f8]"
              >
                {isDeleting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <MoreVertical className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          );
        })}
      </div>
    );
  };

  const renderFilesList = (docList: DocumentListItem[]) => {
    if (viewMode === "list") {
      return (
        <div className="divide-y divide-[#1f2023] overflow-hidden rounded-xl border border-[#1f2023] bg-[#141516]/60">
          {docList.map((item) => {
            const changes = item.edit_count + item.overlay_count;
            const updated = formatRelativeTime(item.updated_at);
            const parentFolder = item.folder_id
              ? folderMap.get(item.folder_id)
              : null;
            const isBusy = busyItemId === item.doc_id;

            return (
              <div
                key={item.doc_id}
                onContextMenu={(e) =>
                  openContextMenu(e, { kind: "file", doc: item })
                }
                className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-[#1a1b1f]"
              >
                <button
                  type="button"
                  onClick={() => onOpenDocument(item.doc_id)}
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#1f2023] bg-[#0f1011] text-[#a1a1aa]">
                    {isImageFilename(item.filename) ? (
                      <ImageIcon className="h-4 w-4 text-[#7170ff]" />
                    ) : (
                      <FileText className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[13px] font-medium text-[#f7f8f8]">
                        {item.filename}
                      </span>
                      {item.is_shared && (
                        <span className="shrink-0 rounded-full bg-[#3ecf8e]/12 px-2 py-0.5 text-[10px] font-medium text-[#3ecf8e]">
                          Shared
                        </span>
                      )}
                      {parentFolder && (
                        <span className="hidden shrink-0 items-center gap-1 rounded bg-[#1c1d1f] px-1.5 py-0.5 text-[10px] text-[#a1a1aa] sm:inline-flex">
                          <Folder className="h-2.5 w-2.5 text-[#7170ff]" />
                          {parentFolder.name}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#8a8f98] tabular-nums">
                      {item.page_count}{" "}
                      {item.page_count === 1 ? "page" : "pages"}
                      {changes > 0
                        ? ` · ${changes} ${changes === 1 ? "edit" : "edits"}`
                        : ""}
                      {updated ? ` · ${updated}` : ""}
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  aria-label={`File options for ${item.filename}`}
                  disabled={isBusy}
                  onClick={(e) =>
                    openContextMenu(e, { kind: "file", doc: item })
                  }
                  className="cursor-pointer rounded-full p-1.5 text-[#62666d] transition-colors hover:bg-[#232428] hover:text-[#f7f8f8]"
                >
                  {isBusy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <MoreVertical className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {docList.map((item) => {
          const changes = item.edit_count + item.overlay_count;
          const updated = formatRelativeTime(item.updated_at);
          const parentFolder = item.folder_id
            ? folderMap.get(item.folder_id)
            : null;
          const isBusy = busyItemId === item.doc_id;

          return (
            <div
              key={item.doc_id}
              onContextMenu={(e) =>
                openContextMenu(e, { kind: "file", doc: item })
              }
              className="group flex flex-col overflow-hidden rounded-xl border border-[#1f2023] bg-[#141516] transition-colors hover:border-[#2a2b2f] hover:bg-[#191a1e]"
            >
              {/* Clickable PDF Preview Tile */}
              <button
                type="button"
                onClick={() => onOpenDocument(item.doc_id)}
                className="relative flex h-28 w-full cursor-pointer items-center justify-center border-b border-[#1f2023] bg-[#0b0c0e] p-4 transition-colors group-hover:bg-[#101114]"
              >
                <div className="flex h-20 w-16 flex-col justify-between rounded-md border border-[#2a2b2f] bg-[#141516] p-2 shadow-sm transition-transform duration-150 group-hover:-translate-y-0.5">
                  <div className="space-y-1">
                    <div className="h-1 w-8 rounded-full bg-[#7170ff]/75" />
                    <div className="h-1 w-full rounded-full bg-[#2a2b2f]" />
                    <div className="h-1 w-4/5 rounded-full bg-[#2a2b2f]" />
                    <div className="h-1 w-3/5 rounded-full bg-[#2a2b2f]" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[8px] font-semibold text-[#62666d]">
                      {isImageFilename(item.filename) ? "IMG" : "PDF"}
                    </span>
                    <span className="text-[8px] text-[#62666d] tabular-nums">
                      {item.page_count}p
                    </span>
                  </div>
                </div>

                {item.is_shared && (
                  <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 rounded-full bg-[#3ecf8e]/12 px-2 py-0.5 text-[10px] font-medium text-[#3ecf8e]">
                    <Share2 className="h-2.5 w-2.5" />
                    Shared
                  </span>
                )}
              </button>

              {/* Meta + Context Trigger */}
              <div className="flex items-center justify-between gap-2 p-3">
                <button
                  type="button"
                  onClick={() => onOpenDocument(item.doc_id)}
                  className="min-w-0 flex-1 cursor-pointer text-left"
                >
                  <div
                    className="truncate text-[13px] font-medium text-[#f7f8f8]"
                    title={item.filename}
                  >
                    {item.filename}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-[#8a8f98] tabular-nums">
                    <span>
                      {item.page_count}{" "}
                      {item.page_count === 1 ? "page" : "pages"}
                    </span>
                    {changes > 0 && <span>· {changes} edits</span>}
                    {updated && <span>· {updated}</span>}
                  </div>
                  {section !== "drive" && parentFolder && (
                    <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-[#7170ff]">
                      <Folder className="h-2.5 w-2.5" />
                      <span className="max-w-[130px] truncate">
                        {parentFolder.name}
                      </span>
                    </div>
                  )}
                </button>

                <button
                  type="button"
                  aria-label={`File options for ${item.filename}`}
                  disabled={isBusy}
                  onClick={(e) =>
                    openContextMenu(e, { kind: "file", doc: item })
                  }
                  className="cursor-pointer rounded-full p-1 text-[#62666d] transition-colors hover:bg-[#232428] hover:text-[#f7f8f8]"
                >
                  {isBusy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <MoreVertical className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="landing-shell flex h-dvh w-full overflow-hidden bg-[#0a0a0b] text-[#f7f8f8] antialiased">
      {/* Desktop Left Sidebar */}
      <aside className="hidden h-full w-[248px] shrink-0 md:block">
        {renderSidebarContent()}
      </aside>

      {/* Mobile Slide-Over Sidebar */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-[264px] border-r border-[#1f2023] bg-[#0a0a0b] shadow-2xl">
            {renderSidebarContent()}
          </aside>
        </div>
      )}

      {/* Right Inset Rounded Content Panel */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col p-2 md:py-2.5 md:pr-2.5 md:pl-0">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#1f2023] bg-[#0f1011]">
          {/* Panel Header Bar: Search + View Controls + Account */}
          <header className="flex h-[56px] shrink-0 items-center justify-between gap-3 border-b border-[#1f2023] px-4 sm:px-5">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <button
                type="button"
                aria-label="Open menu"
                onClick={() => setMobileNavOpen(true)}
                className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-[#1f2023] text-[#a1a1aa] hover:bg-[#1c1d1f] hover:text-[#f7f8f8] md:hidden"
              >
                <Menu className="h-4 w-4" />
              </button>

              {/* Drive-style Pill Search Bar */}
              <div className="relative w-full max-w-xl">
                <Search className="pointer-events-none absolute top-1/2 left-3.5 h-3.5 w-3.5 -translate-y-1/2 text-[#62666d]" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search in Drive"
                  aria-label="Search in Drive"
                  className="h-9 w-full rounded-full border border-[#1f2023] bg-[#141516] pr-14 pl-9 text-[13px] text-[#f7f8f8] placeholder:text-[#62666d] transition-colors focus:border-[#7170ff]/70 focus:bg-[#18191d] focus:outline-none"
                />
                {search ? (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    aria-label="Clear search"
                    className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-[#62666d] hover:text-[#f7f8f8]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <kbd className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded border border-[#2a2b2f] bg-[#0f1011] px-1.5 py-0.5 font-mono text-[10px] text-[#62666d] sm:inline-block">
                    ⌘K
                  </kbd>
                )}
              </div>
            </div>

            {/* Right Controls */}
            <div className="flex shrink-0 items-center gap-2">
              <div
                className="hidden items-center rounded-lg border border-[#1f2023] bg-[#141516] p-0.5 sm:flex"
                role="group"
                aria-label="Layout view"
              >
                <button
                  type="button"
                  aria-label="Grid view"
                  aria-pressed={viewMode === "grid"}
                  onClick={() => setViewMode("grid")}
                  className={cn(
                    "cursor-pointer rounded-md p-1.5 transition-colors",
                    viewMode === "grid"
                      ? "bg-[#232428] text-[#f7f8f8]"
                      : "text-[#62666d] hover:text-[#a1a1aa]",
                  )}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="List view"
                  aria-pressed={viewMode === "list"}
                  onClick={() => setViewMode("list")}
                  className={cn(
                    "cursor-pointer rounded-md p-1.5 transition-colors",
                    viewMode === "list"
                      ? "bg-[#232428] text-[#f7f8f8]"
                      : "text-[#62666d] hover:text-[#a1a1aa]",
                  )}
                >
                  <List className="h-3.5 w-3.5" />
                </button>
              </div>

              <button
                type="button"
                onClick={onOpenShortcuts}
                aria-label="Keyboard shortcuts"
                title="Keyboard shortcuts"
                className="hidden h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[#8a8f98] transition-colors hover:bg-[#1c1d1f] hover:text-[#f7f8f8] sm:inline-flex"
              >
                <Keyboard className="h-4 w-4" />
              </button>

              {authLoading ? (
                <div
                  data-auth-skeleton="true"
                  className="h-8 w-20 animate-pulse rounded-full bg-[#1c1d1f]"
                />
              ) : isSignedIn && user ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-label="Account menu"
                      className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-[#2a2b2f] bg-[#141516] pr-2.5 pl-1 text-xs font-medium text-[#f7f8f8] transition-colors hover:bg-[#1c1d1f]"
                    >
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-[11px] font-semibold text-[#08090a]">
                        {(user.name || user.email).slice(0, 1).toUpperCase()}
                      </span>
                      <span className="hidden max-w-[90px] truncate sm:inline">
                        {user.name}
                      </span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="end"
                    className="w-56 border-[#2a2b2f] bg-[#141516] p-3 text-[#f7f8f8]"
                  >
                    <div className="space-y-0.5">
                      <div className="text-xs font-semibold text-[#f7f8f8]">
                        {user.name}
                      </div>
                      <div className="truncate text-[11px] text-[#8a8f98]">
                        {user.email}
                      </div>
                    </div>
                    <Separator className="my-2.5 bg-[#1f2023]" />
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        onClick={onOpenAuth}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-[#a1a1aa] hover:bg-[#1c1d1f] hover:text-[#f7f8f8]"
                      >
                        <UserIcon className="h-3.5 w-3.5" />
                        Switch account
                      </button>
                      <button
                        type="button"
                        onClick={onSignOut}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-[#e0705f] hover:bg-[#e0705f]/10"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        Sign out
                      </button>
                    </div>
                  </PopoverContent>
                </Popover>
              ) : (
                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="inline-flex h-8 cursor-pointer items-center rounded-full border border-[#2a2b2f] bg-[#1c1d1f] px-3.5 text-xs font-semibold text-[#f7f8f8] transition-colors hover:bg-[#25262b]"
                >
                  Sign in
                </button>
              )}
            </div>
          </header>

          {/* Error Banner */}
          {error && (
            <div className="border-b border-[#e0705f]/30 bg-[#e0705f]/12 px-5 py-2 text-xs text-[#f7d8d2]">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-[#e0705f]" />
                  <span>{error}</span>
                </div>
                <button
                  type="button"
                  aria-label="Dismiss error"
                  onClick={onDismissError}
                  className="cursor-pointer rounded p-1 hover:bg-[#e0705f]/20"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Main Scrollable Drive Canvas (right-click anywhere for context menu!) */}
          <main
            data-drive-canvas="true"
            onContextMenu={(e) => openContextMenu(e, { kind: "canvas" })}
            className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-6 sm:px-7"
          >
            {/* Section Title / Breadcrumbs */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-5">
              {section === "home" && !query ? (
                <h1 className="text-[22px] font-medium tracking-tight text-[#f7f8f8]">
                  Welcome to verso
                </h1>
              ) : section === "drive" && !query ? (
                <div className="flex flex-wrap items-center gap-1 text-[18px] font-medium tracking-tight">
                  <button
                    type="button"
                    onClick={() => onSelectFolder(null)}
                    className={cn(
                      "cursor-pointer rounded-lg px-2 py-0.5 transition-colors",
                      activeFolderId === null
                        ? "text-[#f7f8f8]"
                        : "text-[#8a8f98] hover:bg-[#1a1b1f] hover:text-[#f7f8f8]",
                    )}
                  >
                    My Drive
                  </button>
                  {breadcrumbs.map((crumb, idx) => {
                    const isLast = idx === breadcrumbs.length - 1;
                    return (
                      <div
                        key={crumb.folder_id}
                        className="flex items-center gap-1"
                      >
                        <ChevronRight className="h-4 w-4 text-[#62666d]" />
                        <button
                          type="button"
                          onClick={() => onSelectFolder(crumb.folder_id)}
                          className={cn(
                            "max-w-[200px] cursor-pointer truncate rounded-lg px-2 py-0.5 transition-colors",
                            isLast
                              ? "text-[#f7f8f8]"
                              : "text-[#8a8f98] hover:bg-[#1a1b1f] hover:text-[#f7f8f8]",
                          )}
                        >
                          {crumb.name}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : query ? (
                <h1 className="text-[20px] font-medium tracking-tight text-[#f7f8f8]">
                  Search results for &ldquo;{search}&rdquo;
                </h1>
              ) : section === "recent" ? (
                <h1 className="text-[20px] font-medium tracking-tight text-[#f7f8f8]">
                  Recent
                </h1>
              ) : section === "shared" ? (
                <h1 className="text-[20px] font-medium tracking-tight text-[#f7f8f8]">
                  Shared
                </h1>
              ) : (
                <h1 className="text-[20px] font-medium tracking-tight text-[#f7f8f8]">
                  Storage
                </h1>
              )}

              <span className="hidden text-[11px] text-[#62666d] lg:inline">
                Press N for folder · U to upload · Right-click or drop files
                anywhere
              </span>
            </div>

            {/* Storage View Summary Card */}
            {section === "storage" && !query && (
              <div className="mb-6 rounded-xl border border-[#1f2023] bg-[#141516] p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <span className="text-2xl font-semibold text-[#f7f8f8] tabular-nums">
                      {formatStorageSize(usedBytes)}
                    </span>{" "}
                    <span className="text-sm text-[#8a8f98] tabular-nums">
                      of {formatStorageSize(quotaBytes)} used
                    </span>
                  </div>
                  <div className="text-xs text-[#8a8f98] tabular-nums">
                    {storageUsage?.document_count ?? documents.length} files ·{" "}
                    {storageUsage?.asset_count ?? 0} saved images &amp;
                    signatures
                  </div>
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#1f2023]">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-300",
                      progressBarColor,
                    )}
                    style={{
                      width: `${usedBytes > 0 ? Math.max(2, usedPct) : 0}%`,
                    }}
                  />
                </div>
                <p className="mt-2.5 text-xs text-[#62666d]">
                  Max {formatFileSize(uploadLimits.max_pdf_bytes)} per PDF (
                  {uploadLimits.max_pdf_pages} pages) · Max{" "}
                  {formatFileSize(uploadLimits.max_image_bytes)} per image.
                </p>
              </div>
            )}

            {/* Loading Skeleton */}
            {loading ? (
              <div data-dashboard-skeleton="true" className="space-y-6">
                <div className="space-y-3">
                  <div className="h-4 w-32 animate-pulse rounded bg-[#141516]" />
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 rounded-xl border border-[#1f2023] bg-[#141516] px-3.5 py-3"
                      >
                        <div className="h-5 w-5 animate-pulse rounded bg-[#1f2023]" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-3.5 w-24 animate-pulse rounded bg-[#1f2023]" />
                          <div className="h-2.5 w-16 animate-pulse rounded bg-[#1a1b1f]" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="h-4 w-28 animate-pulse rounded bg-[#141516]" />
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="space-y-3 rounded-xl border border-[#1f2023] bg-[#141516] p-3.5"
                      >
                        <div className="h-24 w-full animate-pulse rounded-lg bg-[#0f1011]" />
                        <div className="h-3.5 w-28 animate-pulse rounded bg-[#1f2023]" />
                        <div className="h-3 w-20 animate-pulse rounded bg-[#1a1b1f]" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : section === "home" && !query ? (
              /* Google Drive "Welcome" Home Layout: Collapsible Suggested folders + Suggested files */
              <div className="flex flex-1 flex-col gap-6">
                {visibleFolders.length > 0 && (
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => setSuggestedFoldersOpen((v) => !v)}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2 py-1 text-[13px] font-medium text-[#d4d4d8] transition-colors hover:bg-[#1a1b1f]"
                    >
                      {suggestedFoldersOpen ? (
                        <ChevronDown className="h-4 w-4 text-[#8a8f98]" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-[#8a8f98]" />
                      )}
                      <span>Suggested folders</span>
                    </button>
                    {suggestedFoldersOpen &&
                      renderFolderCards(visibleFolders, true)}
                  </div>
                )}

                {visibleDocs.length > 0 && (
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => setSuggestedFilesOpen((v) => !v)}
                      className={cn(
                        "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] font-medium transition-colors",
                        suggestedFilesOpen
                          ? "border-transparent text-[#d4d4d8] hover:bg-[#1a1b1f]"
                          : "border-[#7170ff]/60 bg-[#7170ff]/10 text-[#f7f8f8]",
                      )}
                    >
                      {suggestedFilesOpen ? (
                        <ChevronDown className="h-4 w-4 text-[#8a8f98]" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-[#7170ff]" />
                      )}
                      <span>Suggested files</span>
                    </button>
                    {suggestedFilesOpen && renderFilesList(visibleDocs)}
                  </div>
                )}

                {visibleFolders.length === 0 && visibleDocs.length === 0 && (
                  <div className="my-auto flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#2a2b2f] bg-[#141516]/50 px-6 py-16 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#2a2b2f] bg-[#141516] text-[#a1a1aa]">
                      <Upload className="h-5 w-5" />
                    </div>
                    <h2 className="mt-4 text-sm font-semibold text-[#f7f8f8]">
                      Your drive is ready
                    </h2>
                    <p className="mt-1 max-w-xs text-xs leading-relaxed text-[#8a8f98]">
                      Drop a PDF or image anywhere on this page, click New, or
                      right-click to create a folder.
                    </p>
                    <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => onChooseFile(null)}
                        className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg bg-white px-4 text-xs font-semibold text-[#08090a] hover:bg-[#f4f4f6]"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        Upload file
                      </button>
                      <button
                        type="button"
                        onClick={() => openNewFolderDialog(null)}
                        className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-[#2a2b2f] bg-[#141516] px-4 text-xs font-medium text-[#d4d4d8] hover:bg-[#1c1d1f]"
                      >
                        <FolderPlus className="h-3.5 w-3.5 text-[#7170ff]" />
                        New folder
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* My Drive / Recent / Shared / Storage / Search View */
              <div className="flex flex-1 flex-col gap-7">
                {visibleFolders.length > 0 && (
                  <div className="space-y-3">
                    <div className="text-xs font-medium text-[#8a8f98]">
                      Folders
                    </div>
                    {renderFolderCards(visibleFolders, false)}
                  </div>
                )}

                {visibleDocs.length > 0 && (
                  <div className="space-y-3">
                    <div className="text-xs font-medium text-[#8a8f98]">
                      Files
                    </div>
                    {renderFilesList(visibleDocs)}
                  </div>
                )}

                {visibleFolders.length === 0 && visibleDocs.length === 0 && (
                  <div className="my-auto flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#2a2b2f] bg-[#141516]/50 px-6 py-14 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#2a2b2f] bg-[#141516] text-[#a1a1aa]">
                      {query ? (
                        <Search className="h-5 w-5" />
                      ) : section === "shared" ? (
                        <Share2 className="h-5 w-5" />
                      ) : (
                        <Upload className="h-5 w-5" />
                      )}
                    </div>
                    <h2 className="mt-4 text-sm font-semibold text-[#f7f8f8]">
                      {query
                        ? `No matches for "${search}"`
                        : section === "shared"
                          ? "No shared files yet"
                          : activeFolderId
                            ? `"${activeFolderName}" is empty`
                            : "No files here yet"}
                    </h2>
                    <p className="mt-1 max-w-xs text-xs leading-relaxed text-[#8a8f98]">
                      {query
                        ? "Try a different file or folder name."
                        : section === "shared"
                          ? "Open any file and turn on Share to create a shareable edit link."
                          : "Drop a PDF or image anywhere on the page or right-click to create a folder."}
                    </p>
                    {!query && section !== "shared" && (
                      <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => onChooseFile(uploadTargetFolderId)}
                          className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg bg-white px-4 text-xs font-semibold text-[#08090a] hover:bg-[#f4f4f6]"
                        >
                          <Upload className="h-3.5 w-3.5" />
                          Upload file
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            openNewFolderDialog(uploadTargetFolderId)
                          }
                          className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-[#2a2b2f] bg-[#141516] px-4 text-xs font-medium text-[#d4d4d8] hover:bg-[#1c1d1f]"
                        >
                          <FolderPlus className="h-3.5 w-3.5 text-[#7170ff]" />
                          New folder
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Whole-Page Drag-and-Drop Overlay */}
      <FileDropOverlay
        visible={pageDragging}
        title={`Drop PDFs or images to upload into ${uploadTargetLabel}`}
        subtitle={`Up to ${MAX_BATCH_UPLOAD_FILES} files at once · PDF up to ${formatFileSize(uploadLimits.max_pdf_bytes)} · Images up to ${formatFileSize(uploadLimits.max_image_bytes)}`}
      />

      {/* Right-Click Context Menu */}
      {contextMenu && (
        <div
          role="menu"
          data-drive-context-menu="true"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
          className="fixed z-50 w-52 rounded-xl border border-[#2a2b2f] bg-[#141516] p-1.5 text-[#f7f8f8] shadow-[0_18px_48px_-12px_rgba(0,0,0,0.85)]"
        >
          {contextMenu.kind === "canvas" && (
            <>
              <button
                type="button"
                role="menuitem"
                onClick={() => openNewFolderDialog(uploadTargetFolderId)}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-[#f7f8f8] hover:bg-[#1c1d1f]"
              >
                <FolderPlus className="h-3.5 w-3.5 text-[#7170ff]" />
                <span>New folder</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setContextMenu(null);
                  onChooseFile(uploadTargetFolderId);
                }}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-[#f7f8f8] hover:bg-[#1c1d1f]"
              >
                <Upload className="h-3.5 w-3.5 text-[#a1a1aa]" />
                <span>Upload file</span>
              </button>
              <Separator className="my-1 bg-[#1f2023]" />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setContextMenu(null);
                  onRefresh();
                }}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-[#a1a1aa] hover:bg-[#1c1d1f] hover:text-[#f7f8f8]"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Refresh</span>
              </button>
            </>
          )}

          {contextMenu.kind === "folder" && (
            <>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  const target = contextMenu.folder;
                  setContextMenu(null);
                  setSearch("");
                  setSection("drive");
                  onSelectFolder(target.folder_id);
                }}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-[#f7f8f8] hover:bg-[#1c1d1f]"
              >
                <FolderOpen className="h-3.5 w-3.5 text-[#7170ff]" />
                <span>Open folder</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() =>
                  openNewFolderDialog(contextMenu.folder.folder_id)
                }
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-[#d4d4d8] hover:bg-[#1c1d1f]"
              >
                <FolderPlus className="h-3.5 w-3.5 text-[#8a8f98]" />
                <span>New folder inside</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  const targetId = contextMenu.folder.folder_id;
                  setContextMenu(null);
                  onChooseFile(targetId);
                }}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-[#d4d4d8] hover:bg-[#1c1d1f]"
              >
                <Upload className="h-3.5 w-3.5 text-[#8a8f98]" />
                <span>Upload file here</span>
              </button>
              <Separator className="my-1 bg-[#1f2023]" />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  const target = contextMenu.folder;
                  setContextMenu(null);
                  setRenameTarget(target);
                  setRenameValue(target.name);
                }}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-[#d4d4d8] hover:bg-[#1c1d1f]"
              >
                <Pencil className="h-3.5 w-3.5 text-[#8a8f98]" />
                <span>Rename</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={async () => {
                  const targetId = contextMenu.folder.folder_id;
                  setContextMenu(null);
                  setBusyItemId(targetId);
                  try {
                    await onDeleteFolder(targetId);
                  } finally {
                    setBusyItemId(null);
                  }
                }}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-[#e0705f] hover:bg-[#e0705f]/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete folder</span>
              </button>
            </>
          )}

          {contextMenu.kind === "file" && (
            <>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  const target = contextMenu.doc;
                  setContextMenu(null);
                  onOpenDocument(target.doc_id);
                }}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-[#f7f8f8] hover:bg-[#1c1d1f]"
              >
                <FileText className="h-3.5 w-3.5 text-[#7170ff]" />
                <span>Open in editor</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  const target = contextMenu.doc;
                  setContextMenu(null);
                  setMoveTarget(target);
                }}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-[#d4d4d8] hover:bg-[#1c1d1f]"
              >
                <FolderInput className="h-3.5 w-3.5 text-[#8a8f98]" />
                <span>Move to folder</span>
              </button>
              <Separator className="my-1 bg-[#1f2023]" />
              <button
                type="button"
                role="menuitem"
                onClick={async () => {
                  const targetId = contextMenu.doc.doc_id;
                  setContextMenu(null);
                  setBusyItemId(targetId);
                  try {
                    await onDeleteDocument(targetId);
                  } finally {
                    setBusyItemId(null);
                  }
                }}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-[#e0705f] hover:bg-[#e0705f]/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* Create Folder Dialog */}
      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New folder</DialogTitle>
            <DialogDescription>
              Create a folder inside{" "}
              <span className="font-medium text-foreground">
                {newFolderParentLabel}
              </span>
              .
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void submitNewFolder();
            }}
          >
            <Input
              autoFocus
              placeholder="e.g. Contracts, Invoices, 2026"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setNewFolderOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!newFolderName.trim() || creatingFolder}
              >
                {creatingFolder ? "Creating..." : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Rename Folder Dialog */}
      <Dialog
        open={Boolean(renameTarget)}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename folder</DialogTitle>
            <DialogDescription>
              Choose a new name for this folder.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void submitRenameFolder();
            }}
          >
            <Input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRenameTarget(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!renameValue.trim() || renaming}>
                {renaming ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Move File to Folder Dialog */}
      <Dialog
        open={Boolean(moveTarget)}
        onOpenChange={(open) => {
          if (!open) setMoveTarget(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Move file</DialogTitle>
            <DialogDescription>
              Choose a destination folder for{" "}
              <span className="font-medium text-foreground">
                {moveTarget?.filename}
              </span>
              .
            </DialogDescription>
          </DialogHeader>
          <div className="flex max-h-64 flex-col gap-1 overflow-y-auto py-1">
            <button
              type="button"
              disabled={movingTargetId !== null}
              onClick={() => void handleMoveDoc(null)}
              className={cn(
                "flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60",
                movingTargetId === "__root__"
                  ? "border-ring/60 bg-ring/12"
                  : !moveTarget?.folder_id
                    ? "border-input bg-secondary"
                    : "border-transparent",
              )}
            >
              <span className="flex items-center gap-2">
                <HardDrive className="h-3.5 w-3.5 text-muted-foreground" />
                My Drive (Root)
              </span>
              {movingTargetId === "__root__" ? (
                <span className="inline-flex items-center gap-1.5 text-[11px] text-[#7170ff]">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Moving...
                </span>
              ) : (
                !moveTarget?.folder_id && (
                  <span className="text-[10px] text-muted-foreground">
                    Current
                  </span>
                )
              )}
            </button>
            {folderTreeRows.map(({ folder, depth }) => {
              const isCurrent = moveTarget?.folder_id === folder.folder_id;
              const isMovingHere = movingTargetId === folder.folder_id;
              return (
                <button
                  key={folder.folder_id}
                  type="button"
                  disabled={movingTargetId !== null}
                  onClick={() => void handleMoveDoc(folder.folder_id)}
                  style={{ paddingLeft: `${12 + depth * 16}px` }}
                  className={cn(
                    "flex cursor-pointer items-center justify-between rounded-lg border py-2 pr-3 text-left text-xs font-medium transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60",
                    isMovingHere
                      ? "border-ring/60 bg-ring/12"
                      : isCurrent
                        ? "border-input bg-secondary"
                        : "border-transparent",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Folder className="h-3.5 w-3.5 shrink-0 text-[#7170ff]" />
                    <span className="truncate">{folder.name}</span>
                  </span>
                  {isMovingHere ? (
                    <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] text-[#7170ff]">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Moving...
                    </span>
                  ) : (
                    isCurrent && (
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        Current
                      </span>
                    )
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex justify-end">
            <Button
              variant="outline"
              disabled={movingTargetId !== null}
              onClick={() => setMoveTarget(null)}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
