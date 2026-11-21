import { Account, Client, OAuthProvider } from "appwrite";
import type { AuthConfig, UserInfo } from "@/types";

const DEV_TOKEN_KEY = "editpdf_auth_token";
// Appwrite JWTs expire in 15 minutes; refresh proactively at 11 minutes.
const APPWRITE_JWT_REFRESH_MS = 11 * 60 * 1000;

let activeBearerToken: string | null =
  typeof window !== "undefined" ? localStorage.getItem(DEV_TOKEN_KEY) : null;
let isAppwriteToken = false;
let jwtMintedAt = 0;

let appwriteAccount: Account | null = null;
let pendingRestore: Promise<UserInfo | null> | null = null;
let pendingJwtRefresh: Promise<string | null> | null = null;
let refreshTimerId: number | null = null;

function stopRefreshTimer() {
  if (refreshTimerId !== null && typeof window !== "undefined") {
    window.clearInterval(refreshTimerId);
    refreshTimerId = null;
  }
}

function startRefreshTimer() {
  if (typeof window === "undefined") return;
  stopRefreshTimer();
  refreshTimerId = window.setInterval(() => {
    void refreshAppwriteJwt(true);
  }, APPWRITE_JWT_REFRESH_MS);
}

export function getAuthToken(): string | null {
  return activeBearerToken;
}

export function isAppwriteSessionActive(): boolean {
  return Boolean(appwriteAccount && isAppwriteToken);
}

export function setDevAuthToken(token: string | null) {
  stopRefreshTimer();
  isAppwriteToken = false;
  jwtMintedAt = 0;
  activeBearerToken = token;
  if (typeof window === "undefined") return;
  if (token) {
    localStorage.setItem(DEV_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(DEV_TOKEN_KEY);
  }
}

export function initAppwrite(config: AuthConfig): Account | null {
  const endpoint =
    config.appwrite_endpoint || import.meta.env.VITE_APPWRITE_ENDPOINT || "";
  const projectId =
    config.appwrite_project_id || import.meta.env.VITE_APPWRITE_PROJECT_ID || "";
  if (!endpoint || !projectId) {
    appwriteAccount = null;
    return null;
  }
  const client = new Client().setEndpoint(endpoint).setProject(projectId);
  appwriteAccount = new Account(client);
  return appwriteAccount;
}

/** Silently mint a fresh Appwrite JWT before the 15-minute expiry (or on 401 retry). */
export async function refreshAppwriteJwt(
  force = false,
): Promise<string | null> {
  if (!appwriteAccount || !isAppwriteToken) return activeBearerToken;
  const ageMs = Date.now() - jwtMintedAt;
  if (!force && activeBearerToken && ageMs < APPWRITE_JWT_REFRESH_MS) {
    return activeBearerToken;
  }
  if (!pendingJwtRefresh) {
    pendingJwtRefresh = (async () => {
      try {
        const jwt = await appwriteAccount!.createJWT();
        activeBearerToken = jwt.jwt;
        jwtMintedAt = Date.now();
        return activeBearerToken;
      } catch {
        return null;
      } finally {
        pendingJwtRefresh = null;
      }
    })();
  }
  return pendingJwtRefresh;
}

async function doRestoreAppwriteSession(
  config: AuthConfig,
): Promise<UserInfo | null> {
  const account = initAppwrite(config);
  if (!account) return null;

  // Complete Appwrite OAuth2 Token flow (?userId=...&secret=...) which works
  // reliably on localhost even when third-party cookies are blocked by the browser.
  const url = new URL(window.location.href);
  const userId = url.searchParams.get("userId");
  const secret = url.searchParams.get("secret");
  if (userId && secret) {
    url.searchParams.delete("userId");
    url.searchParams.delete("secret");
    window.history.replaceState({}, "", url.toString());
    try {
      // Clear any stale local dev token before activating OAuth session.
      setDevAuthToken(null);
      await account.createSession(userId, secret);
    } catch {
      // Session may already exist if the callback was retried; continue to account.get().
    }
  }

  try {
    const me = await account.get();
    const jwt = await account.createJWT();
    activeBearerToken = jwt.jwt;
    isAppwriteToken = true;
    jwtMintedAt = Date.now();
    startRefreshTimer();
    return {
      id: me.$id,
      email: me.email,
      name: me.name || me.email || "User",
      provider: "appwrite",
    };
  } catch {
    return null;
  }
}

export function restoreAppwriteSession(
  config: AuthConfig,
): Promise<UserInfo | null> {
  if (!pendingRestore) {
    pendingRestore = doRestoreAppwriteSession(config);
  }
  return pendingRestore;
}

export function startAppwriteOAuth(
  provider: "google" | "github",
  config: AuthConfig,
): boolean {
  const account = appwriteAccount ?? initAppwrite(config);
  if (!account) return false;
  const target =
    provider === "google" ? OAuthProvider.Google : OAuthProvider.Github;
  // Clean any old OAuth callback params from the redirect URL.
  const redirectUrl = new URL(window.location.href);
  redirectUrl.searchParams.delete("userId");
  redirectUrl.searchParams.delete("secret");
  // Use createOAuth2Token instead of createOAuth2Session so localhost works even
  // when browsers block third-party cookies for *.cloud.appwrite.io.
  account.createOAuth2Token(
    target,
    redirectUrl.toString(),
    redirectUrl.toString(),
  );
  return true;
}

export async function signOutEverywhere(): Promise<void> {
  pendingRestore = null;
  pendingJwtRefresh = null;
  setDevAuthToken(null);
  if (appwriteAccount) {
    try {
      await appwriteAccount.deleteSession("current");
    } catch {
      // Ignore when no Appwrite session exists.
    }
  }
}
