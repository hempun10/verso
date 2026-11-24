export const OCR_CACHE_NAME = "verso-ocr-models-v1";
export const OCR_MODEL_BASE = "/models/ocr";

export interface OcrManifest {
  version: string;
  total_bytes: number;
  files: Record<string, { bytes: number; sha256: string }>;
}

export interface LoadedOcrAssets {
  detModel: ArrayBuffer;
  clsModel: ArrayBuffer;
  recModel: ArrayBuffer;
  dictionary: string[];
}

const REQUIRED_FILES = [
  "ch_PP-OCRv4_det_infer.onnx",
  "ch_ppocr_mobile_v2.0_cls_infer.onnx",
  "ch_PP-OCRv4_rec_infer.onnx",
  "ppocr_keys_v1.txt",
] as const;

export async function isOcrModelsCached(): Promise<boolean> {
  if (typeof caches === "undefined") return false;
  try {
    const cache = await caches.open(OCR_CACHE_NAME);
    const checks = await Promise.all(
      REQUIRED_FILES.map((name) => cache.match(`${OCR_MODEL_BASE}/${name}`)),
    );
    return checks.every(Boolean);
  } catch {
    return false;
  }
}

export async function clearOcrModelsCache(): Promise<void> {
  if (typeof caches === "undefined") return;
  await caches.delete(OCR_CACHE_NAME);
}

async function fetchWithProgress(
  url: string,
  cache: Cache | null,
  onChunk: (bytesDelta: number) => void,
): Promise<ArrayBuffer> {
  if (cache) {
    const cached = await cache.match(url);
    if (cached) {
      const buf = await cached.arrayBuffer();
      onChunk(buf.byteLength);
      return buf;
    }
  }

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch OCR asset (${res.status}): ${url}`);
  }

  const reader = res.body?.getReader();
  if (!reader) {
    const buf = await res.arrayBuffer();
    onChunk(buf.byteLength);
    if (cache) {
      await cache.put(url, new Response(buf.slice(0)));
    }
    return buf;
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.byteLength;
      onChunk(value.byteLength);
    }
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  if (cache) {
    try {
      await cache.put(
        url,
        new Response(merged.buffer.slice(0), {
          headers: { "Content-Type": "application/octet-stream" },
        }),
      );
    } catch {
      // Ignore storage quota errors; in-memory buffer still works.
    }
  }
  return merged.buffer;
}

export async function loadOcrModelAssets(
  onProgress?: (percent: number, fromCache: boolean) => void,
): Promise<LoadedOcrAssets> {
  const cache =
    typeof caches !== "undefined" ? await caches.open(OCR_CACHE_NAME) : null;
  const alreadyCached = await isOcrModelsCached();

  let totalBytes = 16_200_000;
  try {
    const manifestRes = await fetch(`${OCR_MODEL_BASE}/manifest.json`);
    if (manifestRes.ok) {
      const manifest = (await manifestRes.json()) as OcrManifest;
      if (manifest.total_bytes > 0) totalBytes = manifest.total_bytes;
    }
  } catch {
    // Use default estimate if manifest is unavailable offline.
  }

  let loadedBytes = 0;
  const report = (delta: number) => {
    loadedBytes += delta;
    if (onProgress) {
      const pct = Math.min(100, Math.round((loadedBytes / totalBytes) * 100));
      onProgress(pct, alreadyCached);
    }
  };

  const [detModel, clsModel, recModel, dictBuf] = await Promise.all(
    REQUIRED_FILES.map((file) =>
      fetchWithProgress(`${OCR_MODEL_BASE}/${file}`, cache, report),
    ),
  );

  const dictText = new TextDecoder("utf-8").decode(dictBuf);
  const lines = dictText.split(/\r?\n/).filter((line) => line.length > 0);
  // PP-OCRv4 CTC layout: index 0 = blank, 1..N = dictionary chars, N+1 = space.
  const dictionary = ["", ...lines, " "];

  return {
    detModel: detModel!,
    clsModel: clsModel!,
    recModel: recModel!,
    dictionary,
  };
}
