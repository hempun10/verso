import * as ort from "onnxruntime-web/wasm";
import type { TextBlock } from "@/types";
import { estimateInkStyle } from "./inkStyle";
import { loadOcrModelAssets } from "./modelCache";
import { decodeCtcText, extractDetBoxes } from "./postprocess";

interface RunRequest {
  type: "run";
  id: number;
  imageBlob: Blob;
  pageIndex: number;
  widthPt: number;
  heightPt: number;
}

interface Sessions {
  det: ort.InferenceSession;
  cls: ort.InferenceSession;
  rec: ort.InferenceSession;
  dictionary: string[];
}

const DET_LIMIT_SIDE = 960;
const DET_MEAN = [0.485, 0.456, 0.406] as const;
const DET_STD = [0.229, 0.224, 0.225] as const;
const REC_HEIGHT = 48;
const CLS_HEIGHT = 48;
const CLS_WIDTH = 192;

// onnxruntime-web/wasm bundles the .mjs loader and resolves the .wasm asset via import.meta.url.
ort.env.wasm.numThreads = 1;

let sessionsPromise: Promise<Sessions> | null = null;

function ensureSessions(): Promise<Sessions> {
  if (!sessionsPromise) {
    sessionsPromise = (async () => {
      const assets = await loadOcrModelAssets((percent, fromCache) => {
        self.postMessage({
          type: "progress",
          stage: fromCache ? "initializing" : "downloading",
          percent,
        });
      });
      self.postMessage({ type: "progress", stage: "initializing", percent: 100 });
      const opts: ort.InferenceSession.SessionOptions = {
        executionProviders: ["wasm"],
        graphOptimizationLevel: "all",
      };
      const [det, cls, rec] = await Promise.all([
        ort.InferenceSession.create(new Uint8Array(assets.detModel), opts),
        ort.InferenceSession.create(new Uint8Array(assets.clsModel), opts),
        ort.InferenceSession.create(new Uint8Array(assets.recModel), opts),
      ]);
      return { det, cls, rec, dictionary: assets.dictionary };
    })().catch((err) => {
      sessionsPromise = null;
      throw err;
    });
  }
  return sessionsPromise;
}

function buildDetTensor(bitmap: ImageBitmap): {
  tensor: ort.Tensor;
  mapW: number;
  mapH: number;
} {
  const maxSide = Math.max(bitmap.width, bitmap.height);
  const ratio = maxSide > DET_LIMIT_SIDE ? DET_LIMIT_SIDE / maxSide : 1;
  const mapW = Math.max(32, Math.round((bitmap.width * ratio) / 32) * 32);
  const mapH = Math.max(32, Math.round((bitmap.height * ratio) / 32) * 32);

  const canvas = new OffscreenCanvas(mapW, mapH);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, mapW, mapH);
  const { data } = ctx.getImageData(0, 0, mapW, mapH);

  const plane = mapW * mapH;
  const input = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    const o = i * 4;
    // PaddleOCR det uses BGR order with ImageNet normalization.
    input[i] = (data[o + 2]! / 255 - DET_MEAN[0]) / DET_STD[0];
    input[plane + i] = (data[o + 1]! / 255 - DET_MEAN[1]) / DET_STD[1];
    input[2 * plane + i] = (data[o]! / 255 - DET_MEAN[2]) / DET_STD[2];
  }
  return { tensor: new ort.Tensor("float32", input, [1, 3, mapH, mapW]), mapW, mapH };
}

function imageDataToNormTensor(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  padW: number,
): ort.Tensor {
  const plane = padW * h;
  const out = new Float32Array(3 * plane);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const src = (y * w + x) * 4;
      const dst = y * padW + x;
      out[dst] = (data[src + 2]! / 255 - 0.5) / 0.5;
      out[plane + dst] = (data[src + 1]! / 255 - 0.5) / 0.5;
      out[2 * plane + dst] = (data[src]! / 255 - 0.5) / 0.5;
    }
  }
  return new ort.Tensor("float32", out, [1, 3, h, padW]);
}

async function runOcrOnImage(req: RunRequest): Promise<TextBlock[]> {
  const sessions = await ensureSessions();
  self.postMessage({ type: "progress", stage: "running", percent: 0 });

  const bitmap = await createImageBitmap(req.imageBlob);
  try {
    const origW = bitmap.width;
    const origH = bitmap.height;
    const ptPerPxX = req.widthPt / Math.max(origW, 1);
    const ptPerPxY = req.heightPt / Math.max(origH, 1);

    const { tensor: detTensor, mapW, mapH } = buildDetTensor(bitmap);
    const detOut = await sessions.det.run({ [sessions.det.inputNames[0]!]: detTensor });
    const probTensor = detOut[sessions.det.outputNames[0]!]!;
    const boxes = extractDetBoxes(
      probTensor.data as Float32Array,
      mapW,
      mapH,
      origW,
      origH,
    );

    const cropCanvas = new OffscreenCanvas(1, 1);
    const cropCtx = cropCanvas.getContext("2d", { willReadFrequently: true })!;
    const recCanvas = new OffscreenCanvas(CLS_WIDTH, REC_HEIGHT);
    const recCtx = recCanvas.getContext("2d", { willReadFrequently: true })!;

    const blocks: TextBlock[] = [];
    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i]!;
      const cw = box.x1 - box.x0;
      const ch = box.y1 - box.y0;
      if (cw < 4 || ch < 4) continue;

      cropCanvas.width = cw;
      cropCanvas.height = ch;
      cropCtx.drawImage(bitmap, box.x0, box.y0, cw, ch, 0, 0, cw, ch);
      const cropPixels = cropCtx.getImageData(0, 0, cw, ch);

      // Optional 180-degree orientation check on wider text lines.
      const clsW = Math.min(CLS_WIDTH, Math.max(1, Math.ceil((cw / ch) * CLS_HEIGHT)));
      recCanvas.width = clsW;
      recCanvas.height = CLS_HEIGHT;
      recCtx.drawImage(cropCanvas, 0, 0, cw, ch, 0, 0, clsW, CLS_HEIGHT);
      const clsImg = recCtx.getImageData(0, 0, clsW, CLS_HEIGHT);
      const clsTensor = imageDataToNormTensor(clsImg.data, clsW, CLS_HEIGHT, CLS_WIDTH);
      const clsOut = await sessions.cls.run({ [sessions.cls.inputNames[0]!]: clsTensor });
      const clsProbs = clsOut[sessions.cls.outputNames[0]!]!.data as Float32Array;
      const rotated180 = (clsProbs[1] ?? 0) > 0.9;

      const recW = Math.min(1024, Math.max(REC_HEIGHT, Math.ceil((cw / ch) * REC_HEIGHT)));
      recCanvas.width = recW;
      recCanvas.height = REC_HEIGHT;
      recCtx.save();
      if (rotated180) {
        recCtx.translate(recW, REC_HEIGHT);
        recCtx.rotate(Math.PI);
      }
      recCtx.drawImage(cropCanvas, 0, 0, cw, ch, 0, 0, recW, REC_HEIGHT);
      recCtx.restore();

      const recImg = recCtx.getImageData(0, 0, recW, REC_HEIGHT);
      const recTensor = imageDataToNormTensor(recImg.data, recW, REC_HEIGHT, recW);
      const recOut = await sessions.rec.run({ [sessions.rec.inputNames[0]!]: recTensor });
      const logits = recOut[sessions.rec.outputNames[0]!]!;
      const timeSteps = logits.dims[1] ?? 0;
      const numClasses = logits.dims[2] ?? 0;
      const { text, confidence } = decodeCtcText(
        logits.data as Float32Array,
        timeSteps,
        numClasses,
        sessions.dictionary,
      );
      if (!text || confidence < 0.45) continue;

      const x0Pt = box.x0 * ptPerPxX;
      const y0Pt = box.y0 * ptPerPxY;
      const x1Pt = box.x1 * ptPerPxX;
      const y1Pt = box.y1 * ptPerPxY;
      const { style, baselineFrac } = estimateInkStyle(
        cropPixels.data,
        cw,
        ch,
        y1Pt - y0Pt,
        text,
        confidence,
      );
      const baselineYPt = y0Pt + (y1Pt - y0Pt) * baselineFrac;

      blocks.push({
        id: `p${req.pageIndex}_s${blocks.length}`,
        page_index: req.pageIndex,
        kind: "scanned",
        text,
        bbox: [
          +x0Pt.toFixed(2),
          +y0Pt.toFixed(2),
          +x1Pt.toFixed(2),
          +y1Pt.toFixed(2),
        ],
        origin: [+x0Pt.toFixed(2), +baselineYPt.toFixed(2)],
        angle_deg: 0,
        font_xref: null,
        style,
      });
    }
    return blocks;
  } finally {
    bitmap.close();
  }
}

self.onmessage = async (event: MessageEvent<RunRequest>) => {
  const msg = event.data;
  if (msg.type !== "run") return;
  try {
    const blocks = await runOcrOnImage(msg);
    self.postMessage({ type: "result", id: msg.id, blocks });
  } catch (err: unknown) {
    self.postMessage({
      type: "error",
      id: msg.id,
      message: err instanceof Error ? err.message : "Browser OCR failed.",
    });
  }
};
