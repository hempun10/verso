import type {
  DocumentListItem,
  FolderItem,
  StorageUsage,
  UploadLimits,
  UserInfo,
} from "@/types";

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

export interface DashboardPageProps {
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
