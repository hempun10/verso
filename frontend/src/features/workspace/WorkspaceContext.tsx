import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  createFolder,
  deleteAsset,
  deleteDocument,
  deleteFolder,
  devLogin,
  fetchAuthConfig,
  fetchCurrentUser,
  fetchOverrideFonts,
  fetchStorageUsage,
  listAssets,
  listDocuments,
  listFolders,
  moveDocumentToFolder,
  updateFolder,
} from "@/api";
import type { LegalTab } from "@/components/LegalDialog";
import { updateUrlParams } from "@/features/editor/types";
import {
  restoreAppwriteSession,
  setDevAuthToken,
  signOutEverywhere,
  startAppwriteOAuth,
} from "@/lib/auth";
import { DEFAULT_UPLOAD_LIMITS } from "@/lib/validation";
import type {
  AssetItem,
  AuthConfig,
  DocumentListItem,
  FolderItem,
  StorageUsage,
  UserInfo,
} from "@/types";
import type { WorkspaceContextValue } from "./types";

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [authConfig, setAuthConfig] = useState<AuthConfig | null>(null);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [view, setView] = useState<"landing" | "dashboard">(() =>
    new URLSearchParams(window.location.search).get("view") === "dashboard"
      ? "dashboard"
      : "landing",
  );
  const [workspaceLoading, setWorkspaceLoading] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search);
    return Boolean(params.get("doc") || params.get("view") === "dashboard");
  });
  const [savedDocs, setSavedDocs] = useState<DocumentListItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [storageUsage, setStorageUsage] = useState<StorageUsage | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [overrideFonts, setOverrideFonts] = useState<string[]>([
    "helvetica",
    "times",
    "courier",
    "georgia",
    "verdana",
    "tahoma",
    "trebuchet",
  ]);
  const [error, setError] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [legalTab, setLegalTab] = useState<LegalTab | null>(null);

  const clearError = useCallback(() => setError(null), []);
  const uploadLimits = authConfig?.limits ?? DEFAULT_UPLOAD_LIMITS;
  const captchaRequired = Boolean(
    authConfig?.captcha_enabled && authConfig.turnstile_site_key,
  );
  const isSignedIn = Boolean(
    user &&
      user.provider !== "guest" &&
      user.id !== "guest" &&
      !user.id.startsWith("gst_"),
  );

  const savedSignatures = useMemo(
    () => assets.filter((a) => a.kind === "signature"),
    [assets],
  );
  const savedImages = useMemo(
    () => assets.filter((a) => a.kind === "image"),
    [assets],
  );

  const refreshWorkspace = useCallback(async (showLoader = false) => {
    if (showLoader) setWorkspaceLoading(true);
    try {
      const [docsList, foldersList, assetsList, storage] = await Promise.all([
        listDocuments(),
        listFolders(),
        listAssets(),
        fetchStorageUsage().catch(() => null),
      ]);
      setSavedDocs(docsList);
      setFolders(foldersList);
      setAssets(assetsList);
      if (storage) setStorageUsage(storage);
    } catch {
      // Ignore if backend isn't ready yet.
    } finally {
      setWorkspaceLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverrideFonts()
      .then(setOverrideFonts)
      .catch(() => {});

    void (async () => {
      try {
        const cfg = await fetchAuthConfig();
        setAuthConfig(cfg);
        if (cfg.mode === "appwrite") {
          const awUser = await restoreAppwriteSession(cfg);
          setUser(awUser ?? (await fetchCurrentUser()));
        } else {
          setUser(await fetchCurrentUser());
        }
      } catch {
        // Keep guest mode if auth endpoint unreachable.
      } finally {
        setAuthLoading(false);
      }

      const params = new URLSearchParams(window.location.search);
      if (params.get("view") === "dashboard" && !params.get("doc")) {
        await refreshWorkspace(true);
      } else if (!params.get("doc")) {
        setWorkspaceLoading(false);
      }
    })();
  }, [refreshWorkspace]);

  const handleOAuthLogin = useCallback(
    (provider: "google" | "github") => {
      if (!authConfig) return;
      if (!startAppwriteOAuth(provider, authConfig)) {
        setError(
          "Social sign-in is currently unavailable. Please try again later.",
        );
      }
    },
    [authConfig],
  );

  const handleDevLogin = async (
    email: string,
    name: string,
    captchaToken?: string | null,
  ) => {
    const res = await devLogin(email, name, captchaToken);
    setDevAuthToken(res.token);
    setUser(res.user);
    const hasUrlDoc = Boolean(
      new URLSearchParams(window.location.search).get("doc"),
    );
    if (!hasUrlDoc) {
      setView("dashboard");
      updateUrlParams(null, null, "dashboard");
    }
    await refreshWorkspace(true);
  };

  const handleSignOutWorkspace = async () => {
    await signOutEverywhere();
    const me = await fetchCurrentUser().catch(() => null);
    setUser(me);
    setSavedDocs([]);
    setFolders([]);
    setAssets([]);
    setCurrentFolderId(null);
    setView("landing");
    updateUrlParams(null, null, "landing");
  };

  const handleCreateFolder = async (name: string, parentId: string | null) => {
    setError(null);
    try {
      const created = await createFolder(name, parentId);
      setFolders((prev) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name)),
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create folder.");
    }
  };

  const handleRenameFolder = async (folderId: string, name: string) => {
    setError(null);
    try {
      const updated = await updateFolder(folderId, { name });
      setFolders((prev) =>
        prev
          .map((f) => (f.folder_id === folderId ? updated : f))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to rename folder.");
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    setError(null);
    try {
      const fallbackParent =
        folders.find((f) => f.folder_id === folderId)?.parent_id ?? null;
      await deleteFolder(folderId);
      setFolders((prev) =>
        prev
          .filter((f) => f.folder_id !== folderId)
          .map((f) =>
            f.parent_id === folderId ? { ...f, parent_id: fallbackParent } : f,
          ),
      );
      setSavedDocs((prev) =>
        prev.map((d) =>
          d.folder_id === folderId ? { ...d, folder_id: fallbackParent } : d,
        ),
      );
      if (currentFolderId === folderId) setCurrentFolderId(fallbackParent);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete folder.");
    }
  };

  const handleMoveDocToFolder = async (
    docId: string,
    folderId: string | null,
  ) => {
    setError(null);
    try {
      await moveDocumentToFolder(docId, folderId);
      setSavedDocs((prev) =>
        prev.map((d) =>
          d.doc_id === docId ? { ...d, folder_id: folderId } : d,
        ),
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to move document.");
    }
  };

  const handleDeleteSavedDoc = async (docId: string) => {
    await deleteDocument(docId);
    setSavedDocs((prev) => prev.filter((d) => d.doc_id !== docId));
    void fetchStorageUsage()
      .then(setStorageUsage)
      .catch(() => {});
  };

  const handleDeleteAsset = async (assetId: string) => {
    await deleteAsset(assetId);
    setAssets((prev) => prev.filter((a) => a.asset_id !== assetId));
  };

  return (
    <WorkspaceContext
      value={{
        authConfig, user, authLoading, isSignedIn, view, setView,
        workspaceLoading, savedDocs, folders, storageUsage,
        currentFolderId, setCurrentFolderId, assets, setAssets,
        savedSignatures, savedImages, overrideFonts, uploadLimits,
        captchaRequired, error, setError, clearError,
        authOpen, setAuthOpen, shortcutsOpen, setShortcutsOpen,
        legalTab, setLegalTab, refreshWorkspace, handleOAuthLogin,
        handleDevLogin, handleSignOutWorkspace, handleCreateFolder,
        handleRenameFolder, handleDeleteFolder, handleMoveDocToFolder,
        handleDeleteSavedDoc, handleDeleteAsset,
      }}
    >
      {children}
    </WorkspaceContext>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }
  return ctx;
}
