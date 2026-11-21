import {
  getAuthToken,
  isAppwriteSessionActive,
  refreshAppwriteJwt,
} from "@/lib/auth";
import type {
  AssetItem,
  AssetKind,
  AuthConfig,
  DocumentDetail,
  DocumentListItem,
  DocumentSummary,
  FolderItem,
  PageOverlay,
  SaveStateResponse,
  ShareResponse,
  StorageUsage,
  TextBlock,
  TextEdit,
  UserInfo,
} from "./types";

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

/** Resolve a relative API path against VITE_API_BASE_URL (or same-origin when unset). */
export function apiUrl(path: string): string {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return API_BASE ? `${API_BASE}${path.startsWith("/") ? path : `/${path}`}` : path;
}

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...(extra ?? {}) };
  const token = getAuthToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function withShareToken(path: string, shareToken?: string | null): string {
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
async function apiFetch(
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

async function ensureOk(res: Response) {
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

export async function fetchOverrideFonts() {
  const res = await ensureOk(await apiFetch("/api/health", { skipAuth: true }));
  const data = (await res.json()) as { override_fonts: string[] };
  return data.override_fonts;
}

// --- Auth ---

export async function fetchAuthConfig() {
  const res = await ensureOk(
    await apiFetch("/api/auth/config", { skipAuth: true }),
  );
  return (await res.json()) as AuthConfig;
}

export async function fetchCurrentUser() {
  const res = await ensureOk(await apiFetch("/api/auth/me"));
  return (await res.json()) as UserInfo;
}

export async function devLogin(
  email: string,
  name: string,
  captchaToken?: string | null,
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (captchaToken) {
    headers["X-Captcha-Token"] = captchaToken;
  }
  const res = await ensureOk(
    await apiFetch("/api/auth/dev-login", {
      method: "POST",
      headers,
      body: JSON.stringify({ email, name }),
      skipAuth: true,
    }),
  );
  return (await res.json()) as { token: string; user: UserInfo };
}

// --- Documents & Saved Sessions ---

export async function listDocuments() {
  const res = await ensureOk(await apiFetch("/api/documents"));
  return (await res.json()) as DocumentListItem[];
}

export async function uploadDocument(
  file: File,
  captchaToken?: string | null,
  folderId?: string | null,
) {
  const form = new FormData();
  form.append("file", file);
  if (folderId) {
    form.append("folder_id", folderId);
  }
  const extraHeaders: Record<string, string> = {};
  if (captchaToken) {
    extraHeaders["X-Captcha-Token"] = captchaToken;
  }
  const res = await ensureOk(
    await apiFetch("/api/documents", {
      method: "POST",
      headers: extraHeaders,
      body: form,
    }),
  );
  return (await res.json()) as DocumentSummary;
}

export async function moveDocumentToFolder(
  docId: string,
  folderId: string | null,
) {
  const res = await ensureOk(
    await apiFetch(`/api/documents/${docId}/folder`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder_id: folderId }),
    }),
  );
  return (await res.json()) as { folder_id: string | null };
}

// --- Folders ---

export async function listFolders() {
  const res = await ensureOk(await apiFetch("/api/folders"));
  return (await res.json()) as FolderItem[];
}

export async function createFolder(name: string, parentId?: string | null) {
  const res = await ensureOk(
    await apiFetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, parent_id: parentId ?? null }),
    }),
  );
  return (await res.json()) as FolderItem;
}

export async function updateFolder(
  folderId: string,
  patch: { name?: string; parent_id?: string | null; move_parent?: boolean },
) {
  const res = await ensureOk(
    await apiFetch(`/api/folders/${folderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }),
  );
  return (await res.json()) as FolderItem;
}

export async function deleteFolder(folderId: string) {
  await ensureOk(
    await apiFetch(`/api/folders/${folderId}`, {
      method: "DELETE",
    }),
  );
}

export async function fetchStorageUsage() {
  const res = await ensureOk(await apiFetch("/api/storage"));
  return (await res.json()) as StorageUsage;
}

export async function fetchDocumentDetail(
  docId: string,
  shareToken?: string | null,
) {
  const res = await ensureOk(
    await apiFetch(withShareToken(`/api/documents/${docId}`, shareToken)),
  );
  return (await res.json()) as DocumentDetail;
}

export async function saveDocumentState(
  docId: string,
  edits: TextEdit[],
  overlays: PageOverlay[],
  shareToken?: string | null,
) {
  const res = await ensureOk(
    await apiFetch(withShareToken(`/api/documents/${docId}/state`, shareToken), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ edits, overlays }),
    }),
  );
  return (await res.json()) as SaveStateResponse;
}

export async function setDocumentShare(docId: string, isShared: boolean) {
  const res = await ensureOk(
    await apiFetch(`/api/documents/${docId}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_shared: isShared }),
    }),
  );
  return (await res.json()) as ShareResponse;
}

export async function deleteDocument(docId: string) {
  await ensureOk(
    await apiFetch(`/api/documents/${docId}`, {
      method: "DELETE",
    }),
  );
}

// --- Saved Signatures & Image Assets ---

export async function listAssets(kind?: AssetKind) {
  const path = kind ? `/api/assets?kind=${kind}` : "/api/assets";
  const res = await ensureOk(await apiFetch(path));
  const items = (await res.json()) as AssetItem[];
  return items.map((item) => ({ ...item, url: apiUrl(item.url) }));
}

export async function createAsset(
  kind: AssetKind,
  name: string,
  dataUrl: string,
) {
  const res = await ensureOk(
    await apiFetch("/api/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, name, data_url: dataUrl }),
    }),
  );
  const item = (await res.json()) as AssetItem;
  return { ...item, url: apiUrl(item.url) };
}

export async function deleteAsset(assetId: string) {
  await ensureOk(
    await apiFetch(`/api/assets/${assetId}`, {
      method: "DELETE",
    }),
  );
}

export async function extractStampMask(
  file: Blob,
  options: {
    mode: "ink" | "engraved" | "cutout";
    sensitivity: number;
    removeInnerWhite: boolean;
  },
) {
  const form = new FormData();
  form.append(
    "file",
    file,
    file instanceof File ? file.name : "stamp-source.png",
  );
  const params = new URLSearchParams({
    mode: options.mode,
    sensitivity: String(Math.round(options.sensitivity)),
    remove_inner_white: String(options.removeInnerWhite),
  });
  const res = await ensureOk(
    await apiFetch(`/api/stamps/extract?${params.toString()}`, {
      method: "POST",
      body: form,
    }),
  );
  return await res.blob();
}

// --- Page Blocks, Preview & Export ---

export async function fetchPageBlocks(
  docId: string,
  pageIndex: number,
  shareToken?: string | null,
) {
  const res = await ensureOk(
    await apiFetch(
      withShareToken(
        `/api/documents/${docId}/pages/${pageIndex}/blocks`,
        shareToken,
      ),
    ),
  );
  return (await res.json()) as TextBlock[];
}

export async function fetchPagePreview(
  docId: string,
  pageIndex: number,
  edits: TextEdit[],
  dpi = 150,
  shareToken?: string | null,
) {
  const res = await ensureOk(
    await apiFetch(
      withShareToken(`/api/documents/${docId}/preview`, shareToken),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page_index: pageIndex, edits, dpi }),
      },
    ),
  );
  return await res.blob();
}

export async function exportEditedPdf(
  docId: string,
  edits: TextEdit[],
  overlays: PageOverlay[] = [],
  shareToken?: string | null,
) {
  const res = await ensureOk(
    await apiFetch(
      withShareToken(`/api/documents/${docId}/export`, shareToken),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ edits, overlays }),
      },
    ),
  );
  return await res.blob();
}

export async function exportEditedImage(
  docId: string,
  pageIndex: number,
  edits: TextEdit[],
  overlays: PageOverlay[] = [],
  dpi = 200,
  shareToken?: string | null,
) {
  const res = await ensureOk(
    await apiFetch(
      withShareToken(`/api/documents/${docId}/export-image`, shareToken),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page_index: pageIndex, edits, overlays, dpi }),
      },
    ),
  );
  return await res.blob();
}
