import type { TextStyle } from "@/types";

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
  if (values.length === 0) return 30;
  values.sort((a, b) => a - b);
  return values[values.length >> 1]!;
}

function toHexByte(v: number): string {
  return Math.max(0, Math.min(255, Math.round(v)))
    .toString(16)
    .padStart(2, "0");
}

/**
 * Pure TypeScript port of backend `_estimate_ink_style`: Otsu ink segmentation,
 * median ink RGB, cap/descender font size, bold weight density, and serif heuristic.
 */
export function estimateInkStyle(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  cropPtHeight: number,
  text: string,
  confidence: number,
): TextStyle {
  const count = width * height;
  const gray = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    const o = i * 4;
    gray[i] = Math.round(
      0.299 * rgba[o]! + 0.587 * rgba[o + 1]! + 0.114 * rgba[o + 2]!,
    );
  }

  // Detect whether background border is darker than ink (light text on dark header).
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
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  let minRow = height;
  let maxRow = -1;
  let inkPixels = 0;

  for (let y = 0; y < height; y++) {
    const rowOff = y * width;
    for (let x = 0; x < width; x++) {
      const idx = rowOff + x;
      const isInk = darkBg ? gray[idx]! > thresh : gray[idx]! < thresh;
      if (isInk) {
        mask[idx] = 1;
        inkPixels++;
        if (y < minRow) minRow = y;
        if (y > maxRow) maxRow = y;
        const o = idx * 4;
        rs.push(rgba[o]!);
        gs.push(rgba[o + 1]!);
        bs.push(rgba[o + 2]!);
      }
    }
  }

  const colorHex =
    rs.length > 0
      ? `#${toHexByte(medianOf(rs))}${toHexByte(medianOf(gs))}${toHexByte(medianOf(bs))}`
      : "#1e1e1e";

  const inkHeightPx = maxRow >= minRow ? maxRow - minRow + 1 : Math.max(height, 1);
  const inkHeightFrac = inkHeightPx / Math.max(height, 1);
  const hasDescender = /[gjpqy]/.test(text);
  const divisor = hasDescender ? 0.92 : 0.72;
  const fontSizePt = Math.max(
    6,
    Math.min(144, Math.round(((cropPtHeight * inkHeightFrac) / divisor) * 10) / 10),
  );

  // Bold heuristic: average horizontal run thickness relative to ink height.
  let runSum = 0;
  let runCount = 0;
  for (let y = minRow; y <= maxRow; y++) {
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
  const bold = avgStroke / Math.max(inkHeightPx, 1) > 0.22;

  // Serif heuristic: top/bottom 14% edge band density vs middle stem band.
  let serif = false;
  if (inkHeightPx >= 8 && inkPixels > 16) {
    const band = Math.max(1, Math.floor(inkHeightPx * 0.14));
    const bandDensity = (yStart: number, yEnd: number) => {
      let sum = 0;
      let total = 0;
      for (let y = Math.max(minRow, yStart); y <= Math.min(maxRow, yEnd); y++) {
        const rowOff = y * width;
        for (let x = 0; x < width; x++) {
          sum += mask[rowOff + x]!;
          total++;
        }
      }
      return total > 0 ? sum / total : 0;
    };
    const edgeDensity =
      (bandDensity(minRow, minRow + band - 1) +
        bandDensity(maxRow - band + 1, maxRow)) /
      2;
    const mid = (minRow + maxRow) >> 1;
    const midDensity = bandDensity(mid - band, mid + band);
    serif = edgeDensity > midDensity * 1.18 && midDensity > 0.06;
  }

  return {
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
  };
}
