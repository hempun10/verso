import {
  getAuthToken,
  isAppwriteSessionActive,
  refreshAppwriteJwt,
} from "@/lib/auth";

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

// Transient HTTP statuses commonly returned while a sleeping container boots (up to ~65s).
const COLD_START_STATUSES = new Set([502, 503, 504]);
const COLD_START_BACKOFF_MS = [2000, 3000, 5000, 5000, 8000, 10000, 10000, 10000, 10000];

type WakeListener = (waking: boolean) => void;
const wakeListeners = new Set<WakeListener>();
let serverWaking = false;

function setServerWaking(next: boolean) {
  if (serverWaking === next) return;
  serverWaking = next;
  for (const listener of wakeListeners) listener(next);
}

/** Subscribe to backend cold-start wake state (used by ServerWakeBanner). */
export function subscribeServerWaking(listener: WakeListener): () => void {
  wakeListeners.add(listener);
  listener(serverWaking);
  return () => {
    wakeListeners.delete(listener);
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

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
 * - Gracefully retries idempotent GET requests during container cold starts (502/503/504)
 */
export async function apiFetch(
  path: string,
  init: {
    method?: string;
    headers?: Record<string, string>;
    body?: BodyInit | null;
    signal?: AbortSignal;
    skipAuth?: boolean;
  } = {},
): Promise<Response> {
  const url = apiUrl(path);
  const { skipAuth = false, headers: extraHeaders, ...rest } = init;
  const method = (rest.method ?? "GET").toUpperCase();
  const canRetryColdStart = method === "GET" || method === "HEAD";

  if (!skipAuth && isAppwriteSessionActive()) {
    await refreshAppwriteJwt(false);
  }

  const doFetch = () =>
    fetch(url, {
      ...rest,
      credentials: "include",
      headers: skipAuth ? extraHeaders : authHeaders(extraHeaders),
    });

  let res: Response | null = null;
  let lastErr: unknown = null;
  const maxAttempts = canRetryColdStart ? COLD_START_BACKOFF_MS.length + 1 : 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      res = await doFetch();
      if (
        canRetryColdStart &&
        COLD_START_STATUSES.has(res.status) &&
        attempt < maxAttempts - 1
      ) {
        setServerWaking(true);
        await sleep(COLD_START_BACKOFF_MS[attempt]!);
        continue;
      }
      if (res.ok) setServerWaking(false);
      break;
    } catch (err: unknown) {
      if (init.signal?.aborted) {
        throw err;
      }
      lastErr = err;
      if (canRetryColdStart && attempt < maxAttempts - 1) {
        setServerWaking(true);
        await sleep(COLD_START_BACKOFF_MS[attempt]!);
        continue;
      }
      setServerWaking(false);
      throw err;
    }
  }

  if (!res) {
    setServerWaking(false);
    throw lastErr instanceof Error ? lastErr : new Error("Server unreachable.");
  }

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
      : COLD_START_STATUSES.has(res.status)
        ? "Document server is starting up. Please try again in a few seconds."
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
