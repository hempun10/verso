import type { PageInfo, TextBlock } from "@/types";
import { clearOcrModelsCache, isOcrModelsCached } from "./modelCache";

export type OcrEnginePreference = "local" | "cloud";
export type OcrRuntimeStage =
  | "idle"
  | "downloading"
  | "initializing"
  | "running"
  | "ready"
  | "fallback";

export interface OcrStatusSnapshot {
  preference: OcrEnginePreference;
  supported: boolean;
  cached: boolean;
  stage: OcrRuntimeStage;
  progress: number;
}

const OCR_PREF_KEY = "verso_ocr_engine";

type StatusListener = (status: OcrStatusSnapshot) => void;
const listeners = new Set<StatusListener>();

interface WorkerMessage {
  type: "progress" | "result" | "error";
  id?: number;
  stage?: "downloading" | "initializing" | "running";
  percent?: number;
  blocks?: TextBlock[];
  message?: string;
}

interface PendingJob {
  resolve: (blocks: TextBlock[]) => void;
  reject: (err: Error) => void;
}

export function supportsBrowserOcr(): boolean {
  if (typeof window === "undefined") return false;
  const hasApis =
    typeof Worker !== "undefined" &&
    typeof OffscreenCanvas !== "undefined" &&
    typeof WebAssembly !== "undefined" &&
    typeof createImageBitmap !== "undefined";
  if (!hasApis) return false;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  // Avoid OOM on very low-RAM mobile devices (< 4 GB).
  if (typeof mem === "number" && mem > 0 && mem < 4) return false;
  return true;
}

function readStoredPreference(): OcrEnginePreference {
  if (typeof window === "undefined") return "local";
  const raw = window.localStorage.getItem(OCR_PREF_KEY);
  return raw === "cloud" ? "cloud" : "local";
}

let status: OcrStatusSnapshot = {
  preference: readStoredPreference(),
  supported: supportsBrowserOcr(),
  cached: false,
  stage: "idle",
  progress: 0,
};

let worker: Worker | null = null;
let nextJobId = 1;
const pendingJobs = new Map<number, PendingJob>();

function emitStatus(patch: Partial<OcrStatusSnapshot>) {
  status = { ...status, ...patch };
  for (const listener of listeners) listener(status);
}

export function getOcrStatus(): OcrStatusSnapshot {
  return status;
}

export function subscribeOcrStatus(listener: StatusListener): () => void {
  listeners.add(listener);
  listener(status);
  void isOcrModelsCached().then((cached) => {
    if (cached !== status.cached) emitStatus({ cached });
  });
  return () => {
    listeners.delete(listener);
  };
}

export function setOcrEnginePreference(preference: OcrEnginePreference): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(OCR_PREF_KEY, preference);
  }
  emitStatus({
    preference,
    stage: preference === "cloud" ? "idle" : status.stage,
  });
}

export function shouldUseBrowserOcr(): boolean {
  return status.supported && status.preference === "local";
}

export async function clearLocalOcrCache(): Promise<void> {
  if (worker) {
    worker.terminate();
    worker = null;
    for (const job of pendingJobs.values()) {
      job.reject(new Error("OCR worker reset."));
    }
    pendingJobs.clear();
  }
  await clearOcrModelsCache();
  emitStatus({ cached: false, stage: "idle", progress: 0 });
}

function ensureWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./ocr.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const msg = event.data;
      if (msg.type === "progress" && msg.stage) {
        emitStatus({
          stage: msg.stage,
          progress: msg.percent ?? 0,
        });
        return;
      }
      if (msg.id == null) return;
      const pending = pendingJobs.get(msg.id);
      if (!pending) return;
      pendingJobs.delete(msg.id);

      if (msg.type === "result" && msg.blocks) {
        emitStatus({ cached: true, stage: "ready", progress: 100 });
        pending.resolve(msg.blocks);
      } else {
        emitStatus({ stage: "fallback" });
        pending.reject(new Error(msg.message ?? "Browser OCR failed."));
      }
    };
    worker.onerror = (event) => {
      const err = new Error(event.message || "Browser OCR worker crashed.");
      emitStatus({ stage: "fallback" });
      for (const job of pendingJobs.values()) job.reject(err);
      pendingJobs.clear();
      worker?.terminate();
      worker = null;
    };
  }
  return worker;
}

export function runBrowserOcr(
  imageBlob: Blob,
  pageInfo: PageInfo,
): Promise<TextBlock[]> {
  if (!supportsBrowserOcr()) {
    return Promise.reject(new Error("Browser OCR unsupported on this device."));
  }
  const w = ensureWorker();
  const id = nextJobId++;
  return new Promise<TextBlock[]>((resolve, reject) => {
    pendingJobs.set(id, { resolve, reject });
    w.postMessage({
      type: "run",
      id,
      imageBlob,
      pageIndex: pageInfo.page_index,
      widthPt: pageInfo.width_pt,
      heightPt: pageInfo.height_pt,
    });
  });
}
