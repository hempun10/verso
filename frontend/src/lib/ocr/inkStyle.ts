import type { TextStyle } from "@/types";

export interface InkStyleResult {
  style: TextStyle;
  baselineFrac: number;
}

function otsuThreshold(gray: Uint8Array): number {
  const hist = new Uint32Array(256);
  for (let i = 0; i < gray.length; i++) hist[gray[i]!]!++;

  const total = gray.length;
  let sumAll = 0;
  for (let i = 0; i < 256; i++) sumAll += i * hist[i]!;

  let sumB = 0;
  let weightB = 0;
  let maxVar = -1;
  let threshold = 128;

  for (let t = 0; t < 256; t++) {
    weightB += hist[t]!;
    if (weightB === 0) continue;
    const weightF = total - weightB;
    if (weightF === 0) break;

    sumB += t * hist[t]!;
    const meanB = sumB / weightB;
    const meanF = (sumAll - sumB) / weightF;
    const between = weightB * weightF * (meanB - meanF) * (meanB - meanF);
    if (between > maxVar) {
      maxVar = between;
      threshold = t;
    }
  }
  return threshold;
}

function medianOf(values: number[]): number {
  if (values.length === 0) return 20;
  values.sort((a, b) => a - b);
  return values[values.length >> 1]!;
}

function toHexByte(v: number): string {
  return Math.max(0, Math.min(255, Math.round(v)))
    .toString(16)
    .padStart(2, "0");
}

/**
 * Pure TypeScript port of backend `_estimate_ink_style`:
 * - Projection-based cap height, x-height, and exact baseline
 * - Darkest 30% toner core color (avoids gray anti-aliased edge washout)
 * - Baseline serif-foot flare + x-height ratio for Times vs Helvetica
 */
export function estimateInkStyle(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  cropPtHeight: number,
  text: string,
  confidence: number,
): InkStyleResult {
  const count = width * height;
  const gray = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    const o = i * 4;
    gray[i] = Math.round(
      0.299 * rgba[o]! + 0.587 * rgba[o + 1]! + 0.114 * rgba[o + 2]!,
    );
  }

  const borderSamples: number[] = [];
  for (let x = 0; x < width; x++) {
    borderSamples.push(gray[x]!);
    borderSamples.push(gray[(height - 1) * width + x]!);
  }
  for (let y = 0; y < height; y++) {
    borderSamples.push(gray[y * width]!);
    borderSamples.push(gray[y * width + (width - 1)]!);
  }
  const darkBg = medianOf(borderSamples) < 128;
  const thresh = otsuThreshold(gray);

  const mask = new Uint8Array(count);
  const rowSums = new Float64Array(height);
  const inkEntries: Array<{ luma: number; r: number; g: number; b: number }> = [];

  for (let y = 0; y < height; y++) {
    const rowOff = y * width;
    let rSum = 0;
    for (let x = 0; x < width; x++) {
      const idx = rowOff + x;
      const gVal = gray[idx]!;
      const isInk = darkBg ? gVal > thresh : gVal < thresh;
      if (isInk) {
        mask[idx] = 1;
        rSum++;
        const o = idx * 4;
        inkEntries.push({
          luma: gVal,
          r: rgba[o]!,
          g: rgba[o + 1]!,
          b: rgba[o + 2]!,
        });
      }
    }
    rowSums[y] = rSum;
  }

  // Sample true toner core color (darkest 30% on light paper, brightest 30% on dark header).
  let colorHex = darkBg ? "#f5f5f5" : "#141414";
  if (inkEntries.length > 0) {
    inkEntries.sort((a, b) => (darkBg ? b.luma - a.luma : a.luma - b.luma));
    const coreLen = Math.max(1, Math.ceil(inkEntries.length * 0.3));
    const core = inkEntries.slice(0, coreLen);
    colorHex = `#${toHexByte(medianOf(core.map((p) => p.r)))}${toHexByte(medianOf(core.map((p) => p.g)))}${toHexByte(medianOf(core.map((p) => p.b)))}`;
  }

  let maxRowSum = 0;
  for (let y = 0; y < height; y++) {
    if (rowSums[y]! > maxRowSum) maxRowSum = rowSums[y]!;
  }

  let bodyTop = 0;
  let baselineY = Math.max(0, height - 1);
  let capTop = 0;
  if (maxRowSum > 0) {
    for (let y = 0; y < height; y++) {
      if (rowSums[y]! >= 0.35 * maxRowSum) {
        bodyTop = y;
        break;
      }
    }
    for (let y = height - 1; y >= 0; y--) {
      if (rowSums[y]! >= 0.35 * maxRowSum) {
        baselineY = y;
        break;
      }
    }
    for (let y = 0; y < height; y++) {
      if (rowSums[y]! >= 0.04 * maxRowSum) {
        capTop = y;
        break;
      }
    }
  }

  const xH = Math.max(1, baselineY - bodyTop + 1);
  const capH = Math.max(1, baselineY - capTop + 1);
  const hasCapOrAsc = /[A-Z0-9bdfhklt]/.test(text);
  const emPx = hasCapOrAsc ? capH / 0.7 : xH / 0.5;
  const fontSizePt = Math.max(
    6,
    Math.min(144, Math.round(emPx * (cropPtHeight / Math.max(height, 1)) * 10) / 10),
  );
  const baselineFrac = (baselineY + 0.5) / Math.max(height, 1);

  // Horizontal stroke run thickness relative to cap height for bold detection.
  let runSum = 0;
  let runCount = 0;
  for (let y = capTop; y <= baselineY; y++) {
    const rowOff = y * width;
    let run = 0;
    for (let x = 0; x < width; x++) {
      if (mask[rowOff + x]) {
        run++;
      } else if (run > 0) {
        runSum += run;
        runCount++;
        run = 0;
      }
    }
    if (run > 0) {
      runSum += run;
      runCount++;
    }
  }
  const avgStroke = runCount > 0 ? runSum / runCount : 0;
  const bold = avgStroke / Math.max(capH, 1) > 0.19;

  // Baseline serif-foot flare vs middle body density + lower x-height ratio.
  const midLo = bodyTop + Math.max(1, Math.floor(xH * 0.2));
  const midHi = Math.max(midLo + 1, baselineY - Math.max(1, Math.floor(xH * 0.2)));
  let midSum = 0;
  let midCount = 0;
  for (let y = midLo; y < Math.min(height, midHi); y++) {
    midSum += rowSums[y]!;
    midCount++;
  }
  const midMean = midCount > 0 ? midSum / midCount : Math.max(maxRowSum, 1);
  let basePeak = midMean;
  for (let y = Math.max(0, baselineY - 1); y <= Math.min(height - 1, baselineY + 1); y++) {
    if (rowSums[y]! > basePeak) basePeak = rowSums[y]!;
  }
  const baseRatio = basePeak / Math.max(midMean, 1);
  const xRatio = xH / Math.max(capH, 1);
  const serif =
    baseRatio > (bold ? 1.24 : 1.44) || (xRatio < 0.7 && baseRatio > 1.24);

  return {
    style: {
      font_family: serif ? "times" : "helvetica",
      original_font_name: "inferred",
      font_source: "system",
      font_size_pt: fontSizePt,
      color_hex: colorHex,
      bold,
      italic: false,
      serif,
      mono: false,
      confidence: Math.round(Math.max(0, Math.min(1, confidence)) * 1000) / 1000,
    },
    baselineFrac,
  };
}
