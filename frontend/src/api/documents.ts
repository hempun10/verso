import { apiFetch, ensureOk, withShareToken } from "@/api/client";
import type {
  DocumentDetail,
  DocumentListItem,
  DocumentSummary,
  PageOverlay,
  SaveStateResponse,
  ShareResponse,
  TextBlock,
  TextEdit,
} from "@/types";

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
  await ensureOk(await apiFetch(`/api/documents/${docId}`, { method: "DELETE" }));
}

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
