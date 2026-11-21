/**
 * Reusable HTML5 Canvas 2D export utilities.
 */

export interface CroppedPngResult {
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Tightly crop a transparent HTMLCanvasElement to its non-transparent ink bounding box
 * (with optional padding) and return a PNG data URL + cropped pixel dimensions.
 */
export function cropCanvasToTrimmedPng(
  canvas: HTMLCanvasElement,
  pad = 12,
  alphaThreshold = 8,
): CroppedPngResult | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const { width, height } = canvas;
  const imgData = ctx.getImageData(0, 0, width, height).data;

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let hasInk = false;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if ((imgData[(y * width + x) * 4 + 3] ?? 0) > alphaThreshold) {
        hasInk = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (!hasInk) return null;

  const sx = Math.max(0, minX - pad);
  const sy = Math.max(0, minY - pad);
  const sw = Math.min(width - sx, maxX - minX + 1 + pad * 2);
  const sh = Math.min(height - sy, maxY - minY + 1 + pad * 2);

  const out = document.createElement("canvas");
  out.width = sw;
  out.height = sh;
  const outCtx = out.getContext("2d");
  if (!outCtx) return null;

  outCtx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
  return {
    dataUrl: out.toDataURL("image/png"),
    width: sw,
    height: sh,
  };
}
