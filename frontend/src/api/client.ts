import {
  getAuthToken,
  isAppwriteSessionActive,
  refreshAppwriteJwt,
} from "@/lib/auth";

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

/** Resolve a relative API path against VITE_API_BASE_URL (or same-origin when unset). */
export function apiUrl(path: string): string {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return API_BASE
    ? `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`
    : path;
}

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...(extra ?? {}) };
  const token = getAuthToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export function withShareToken(
  path: string,
  shareToken?: string | null,
): string {
  if (!shareToken) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}share_token=${encodeURIComponent(shareToken)}`;
}

/**
 * Authenticated fetch wrapper:
 * - Includes credentials so isolated per-browser guest cookies work cleanly
 * - Proactively refreshes Appwrite JWTs before their 15-minute expiry
 * - Retries once after forcing a JWT refresh if the server returns 401
 */
export async function apiFetch(
  path: string,
  init: {
    method?: string;
    headers?: Record<string, string>;
    body?: BodyInit | null;
    skipAuth?: boolean;
  } = {},
): Promise<Response> {
  const url = apiUrl(path);
  const { skipAuth = false, headers: extraHeaders, ...rest } = init;

  if (!skipAuth && isAppwriteSessionActive()) {
    await refreshAppwriteJwt(false);
  }

  const doFetch = () =>
    fetch(url, {
      ...rest,
      credentials: "include",
      headers: skipAuth ? extraHeaders : authHeaders(extraHeaders),
    });

  let res = await doFetch();
  if (res.status === 401 && !skipAuth && isAppwriteSessionActive()) {
    const refreshed = await refreshAppwriteJwt(true);
    if (refreshed) {
      res = await doFetch();
    }
  }
  return res;
}

export async function ensureOk(res: Response): Promise<Response> {
  if (res.ok) return res;
  let detail =
    res.status === 429
      ? "Too many requests. Please wait a moment and try again."
      : `Request failed (${res.status})`;
  try {
    const body = (await res.json()) as { detail?: string };
    if (body.detail) detail = body.detail;
  } catch {
    if (res.status === 429) {
      const retryAfter = res.headers.get("Retry-After");
      if (retryAfter) {
        detail = `Too many requests. Please retry in ${retryAfter}s.`;
      }
    }
  }
  throw new Error(detail);
}
