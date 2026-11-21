import type React from "react";
import type { LegalTab } from "@/components/LegalDialog";
import type {
  AssetItem,
  AuthConfig,
  DocumentListItem,
  FolderItem,
  StorageUsage,
  UploadLimits,
  UserInfo,
} from "@/types";

export interface WorkspaceContextValue {
  authConfig: AuthConfig | null;
  user: UserInfo | null;
  authLoading: boolean;
  isSignedIn: boolean;
  view: "landing" | "dashboard";
  setView: (view: "landing" | "dashboard") => void;
  workspaceLoading: boolean;
  savedDocs: DocumentListItem[];
  folders: FolderItem[];
  storageUsage: StorageUsage | null;
  currentFolderId: string | null;
  setCurrentFolderId: (id: string | null) => void;
  assets: AssetItem[];
  setAssets: React.Dispatch<React.SetStateAction<AssetItem[]>>;
  savedSignatures: AssetItem[];
  savedImages: AssetItem[];
  overrideFonts: string[];
  uploadLimits: UploadLimits;
  captchaRequired: boolean;
  error: string | null;
  setError: (msg: string | null) => void;
  clearError: () => void;
  authOpen: boolean;
  setAuthOpen: (open: boolean) => void;
  shortcutsOpen: boolean;
  setShortcutsOpen: (open: boolean) => void;
  legalTab: LegalTab | null;
  setLegalTab: (tab: LegalTab | null) => void;
  refreshWorkspace: (showLoader?: boolean) => Promise<void>;
  handleOAuthLogin: (provider: "google" | "github") => void;
  handleDevLogin: (
    email: string,
    name: string,
    captchaToken?: string | null,
  ) => Promise<void>;
  handleSignOutWorkspace: () => Promise<void>;
  handleCreateFolder: (name: string, parentId: string | null) => Promise<void>;
  handleRenameFolder: (folderId: string, name: string) => Promise<void>;
  handleDeleteFolder: (folderId: string) => Promise<void>;
  handleMoveDocToFolder: (
    docId: string,
    folderId: string | null,
  ) => Promise<void>;
  handleDeleteSavedDoc: (docId: string) => Promise<void>;
  handleDeleteAsset: (assetId: string) => Promise<void>;
}
