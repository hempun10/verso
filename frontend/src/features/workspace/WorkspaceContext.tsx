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
  devLogin,
  fetchAuthConfig,
  fetchCurrentUser,
  fetchOverrideFonts,
  fetchStorageUsage,
  listAssets,
  listDocuments,
  listFolders,
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
import {
  hasOAuthCallbackParams,
  isAuthenticatedUser,
  isProtectedUrl,
  resetToLandingUrl,
} from "./authGuard";
import type { WorkspaceContextValue } from "./types";
import { useWorkspaceMutations } from "./useWorkspaceMutations";

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
  const isSignedIn = isAuthenticatedUser(user);

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

    const oauthCallback = hasOAuthCallbackParams();
    const wantsProtected = isProtectedUrl();

    void (async () => {
      let resolvedUser: UserInfo | null = null;
      try {
        const cfg = await fetchAuthConfig();
        setAuthConfig(cfg);
        if (cfg.mode === "appwrite") {
          const awUser = await restoreAppwriteSession(cfg);
          resolvedUser = awUser ?? (await fetchCurrentUser());
        } else {
          resolvedUser = await fetchCurrentUser();
        }
        setUser(resolvedUser);
      } catch {
        // Keep unauthenticated state if auth endpoint is unreachable.
      } finally {
        setAuthLoading(false);
      }

      const signedIn = isAuthenticatedUser(resolvedUser);
      const params = new URLSearchParams(window.location.search);
      const hasDoc = Boolean(params.get("doc"));

      if (!signedIn) {
        setView("landing");
        setWorkspaceLoading(false);
        if (wantsProtected) {
          resetToLandingUrl();
          setAuthOpen(true);
        }
        return;
      }

      if (hasDoc) return;
      if (oauthCallback || wantsProtected) {
        setView("dashboard");
        updateUrlParams(null, null, "dashboard");
        await refreshWorkspace(true);
      } else {
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

  const mutations = useWorkspaceMutations({
    folders,
    currentFolderId,
    setFolders,
    setSavedDocs,
    setAssets,
    setStorageUsage,
    setCurrentFolderId,
    setError,
  });

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
        handleDevLogin, handleSignOutWorkspace, ...mutations,
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
