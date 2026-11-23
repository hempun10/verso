import {
  createContext,
  type ReactNode,
  type SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { devLogin, fetchAuthConfig, fetchCurrentUser } from "@/api";
import type { LegalTab } from "@/components/LegalDialog";
import { updateUrlParams } from "@/features/editor/types";
import {
  restoreAppwriteSession,
  setDevAuthToken,
  signOutEverywhere,
  startAppwriteOAuth,
} from "@/lib/auth";
import { queryKeys } from "@/lib/queryClient";
import { DEFAULT_UPLOAD_LIMITS } from "@/lib/validation";
import type { AssetItem, UserInfo } from "@/types";
import { useWorkspaceMutations } from "../hooks/useWorkspaceMutations";
import { useWorkspaceQueries } from "../hooks/useWorkspaceQueries";
import type { WorkspaceContextValue } from "../types";
import {
  hasOAuthCallbackParams,
  isAuthenticatedUser,
  isProtectedUrl,
  resetToLandingUrl,
} from "../utils/authGuard";

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [view, setView] = useState<"landing" | "dashboard">(() =>
    new URLSearchParams(window.location.search).get("view") === "dashboard"
      ? "dashboard"
      : "landing",
  );
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [legalTab, setLegalTab] = useState<LegalTab | null>(null);

  const isSignedIn = isAuthenticatedUser(user);
  const {
    authConfig,
    overrideFonts,
    savedDocs,
    folders,
    assets,
    storageUsage,
    workspaceLoading,
    refreshWorkspace,
    clearWorkspaceCache,
  } = useWorkspaceQueries(isSignedIn);

  const clearError = useCallback(() => setError(null), []);
  const uploadLimits = authConfig?.limits ?? DEFAULT_UPLOAD_LIMITS;
  const captchaRequired = Boolean(
    authConfig?.captcha_enabled && authConfig.turnstile_site_key,
  );

  const setAssets = useCallback(
    (updater: SetStateAction<AssetItem[]>) => {
      queryClient.setQueryData<AssetItem[]>(queryKeys.assets, (prev = []) =>
        typeof updater === "function" ? updater(prev) : updater,
      );
    },
    [queryClient],
  );

  const savedSignatures = useMemo(
    () => assets.filter((a) => a.kind === "signature"),
    [assets],
  );
  const savedImages = useMemo(
    () => assets.filter((a) => a.kind === "image"),
    [assets],
  );

  useEffect(() => {
    const oauthCallback = hasOAuthCallbackParams();
    const wantsProtected = isProtectedUrl();

    void (async () => {
      let resolvedUser: UserInfo | null = null;
      try {
        const cfg = await queryClient.fetchQuery({
          queryKey: queryKeys.authConfig,
          queryFn: fetchAuthConfig,
          staleTime: 5 * 60_000,
        });
        if (cfg.mode === "appwrite") {
          resolvedUser = await restoreAppwriteSession(cfg);
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
        if (wantsProtected) {
          resetToLandingUrl();
          setAuthOpen(true);
        }
        return;
      }

      if (!hasDoc && (oauthCallback || wantsProtected)) {
        setView("dashboard");
        updateUrlParams(null, null, "dashboard");
      }
    })();
  }, [queryClient]);

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

  const devLoginMut = useMutation({
    mutationFn: ({
      email,
      name,
      captchaToken,
    }: {
      email: string;
      name: string;
      captchaToken?: string | null;
    }) => devLogin(email, name, captchaToken),
  });

  const handleDevLogin = async (
    email: string,
    name: string,
    captchaToken?: string | null,
  ) => {
    const res = await devLoginMut.mutateAsync({ email, name, captchaToken });
    setDevAuthToken(res.token);
    setUser(res.user);
    const hasUrlDoc = Boolean(
      new URLSearchParams(window.location.search).get("doc"),
    );
    if (!hasUrlDoc) {
      setView("dashboard");
      updateUrlParams(null, null, "dashboard");
    }
    await refreshWorkspace();
  };

  const handleSignOutWorkspace = async () => {
    await signOutEverywhere();
    clearWorkspaceCache();
    const me = await fetchCurrentUser().catch(() => null);
    setUser(me);
    setCurrentFolderId(null);
    setView("landing");
    updateUrlParams(null, null, "landing");
  };

  const mutations = useWorkspaceMutations({
    folders,
    currentFolderId,
    setCurrentFolderId,
    setError,
  });

  return (
    <WorkspaceContext
      value={{
        authConfig,
        user,
        authLoading,
        isSignedIn,
        view,
        setView,
        workspaceLoading,
        savedDocs,
        folders,
        storageUsage,
        currentFolderId,
        setCurrentFolderId,
        assets,
        setAssets,
        savedSignatures,
        savedImages,
        overrideFonts,
        uploadLimits,
        captchaRequired,
        error,
        setError,
        clearError,
        authOpen,
        setAuthOpen,
        shortcutsOpen,
        setShortcutsOpen,
        legalTab,
        setLegalTab,
        refreshWorkspace,
        handleOAuthLogin,
        handleDevLogin,
        handleSignOutWorkspace,
        ...mutations,
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
