import type { PageOverlay, TextEdit } from "@/types";

export type EditMap = Record<string, TextEdit>;

export interface HistorySnapshot {
  edits: EditMap;
  overlays: PageOverlay[];
}

export interface DocMeta {
  isOwner: boolean;
  isShared: boolean;
  shareToken: string | null;
  version: number;
  updatedBy: string;
}

export interface PagePreview {
  key: string;
  url: string;
  loaded: boolean;
}

export interface StampSeed {
  file?: File | null;
  imageUrl?: string | null;
  name?: string;
}

export const EMPTY_SNAPSHOT: HistorySnapshot = { edits: {}, overlays: [] };

export const INITIAL_DOC_META: DocMeta = {
  isOwner: true,
  isShared: false,
  shareToken: null,
  version: 1,
  updatedBy: "",
};

export function makeOverlayId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function editsListToMap(edits: TextEdit[]): EditMap {
  const map: EditMap = {};
  for (const e of edits) map[e.block_id] = e;
  return map;
}

export function updateUrlParams(
  docId: string | null,
  shareToken: string | null,
  view: "landing" | "dashboard" = "landing",
): void {
  const url = new URL(window.location.href);
  if (docId) {
    url.searchParams.set("doc", docId);
    url.searchParams.delete("view");
    if (shareToken) url.searchParams.set("share", shareToken);
    else url.searchParams.delete("share");
  } else {
    url.searchParams.delete("doc");
    url.searchParams.delete("share");
    if (view === "dashboard") url.searchParams.set("view", "dashboard");
    else url.searchParams.delete("view");
  }
  window.history.replaceState({}, "", url.toString());
}
