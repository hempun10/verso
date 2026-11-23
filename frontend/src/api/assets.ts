import { apiFetch, apiUrl, ensureOk } from "@/api/client";
import type { AssetItem, AssetKind } from "@/types";

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
  await ensureOk(await apiFetch(`/api/assets/${assetId}`, { method: "DELETE" }));
}

export async function fetchAssetBlob(
  url: string,
  signal?: AbortSignal,
): Promise<Blob> {
  const res = await ensureOk(await apiFetch(url, { signal }));
  return await res.blob();
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
