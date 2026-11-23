import { apiUrl } from "@/api";
import type { ImageOverlay } from "@/types";

export type HandleCorner = "nw" | "ne" | "sw" | "se";
export type CropHandle = HandleCorner | "n" | "s" | "e" | "w";
export type CropBox = [number, number, number, number];

export const MIN_SIZE_PT = 12;
export const MIN_CROP_FRAC = 0.06;
export const SNAP_ANGLES = [-180, -135, -90, -45, 0, 45, 90, 135, 180];

export function clampPt(val: number, max: number): number {
  return Math.max(0, Math.min(max, val));
}

export function imageSrcFor(overlay: ImageOverlay): string {
  if (overlay.data_url) return overlay.data_url;
  if (overlay.asset_url) return apiUrl(overlay.asset_url);
  if (overlay.asset_id) return apiUrl(`/api/assets/${overlay.asset_id}/content`);
  return "";
}

/**
 * Compute the uncropped full-image rectangle (center + size in PDF pts) from
 * an ImageOverlay's current visible bbox, crop, and rotation.
 */
export function getFullImageGeometry(overlay: ImageOverlay) {
  const [x0, y0, x1, y1] = overlay.bbox;
  const [ocx0, ocy0, ocx1, ocy1] = overlay.crop ?? [0, 0, 1, 1];
  const ocw = Math.max(0.01, ocx1 - ocx0);
  const och = Math.max(0.01, ocy1 - ocy0);

  const visW = Math.max(1, x1 - x0);
  const visH = Math.max(1, y1 - y0);
  const fullW = visW / ocw;
  const fullH = visH / och;

  const visCx = (x0 + x1) / 2;
  const visCy = (y0 + y1) / 2;
  const localDx = ((ocx0 + ocx1) / 2 - 0.5) * fullW;
  const localDy = ((ocy0 + ocy1) / 2 - 0.5) * fullH;

  const rad = (overlay.angle_deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const fullCx = visCx - (localDx * cos - localDy * sin);
  const fullCy = visCy - (localDx * sin + localDy * cos);

  return {
    fullCx,
    fullCy,
    fullW,
    fullH,
    fullX0: fullCx - fullW / 2,
    fullY0: fullCy - fullH / 2,
  };
}

/**
 * Convert a new normalized crop box `[cx0, cy0, cx1, cy1]` back into the tight
 * page-space `bbox` and normalized `crop` (or `null` when uncropped).
 */
export function computeCroppedPatch(
  overlay: ImageOverlay,
  newCrop: CropBox,
): { bbox: [number, number, number, number]; crop: CropBox | null } {
  const { fullCx, fullCy, fullW, fullH } = getFullImageGeometry(overlay);
  const [ncx0, ncy0, ncx1, ncy1] = newCrop;

  const newW = Math.max(MIN_SIZE_PT, (ncx1 - ncx0) * fullW);
  const newH = Math.max(MIN_SIZE_PT, (ncy1 - ncy0) * fullH);
  const localDx = ((ncx0 + ncx1) / 2 - 0.5) * fullW;
  const localDy = ((ncy0 + ncy1) / 2 - 0.5) * fullH;

  const rad = (overlay.angle_deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const newCx = fullCx + (localDx * cos - localDy * sin);
  const newCy = fullCy + (localDx * sin + localDy * cos);

  const isFull =
    ncx0 < 0.005 && ncy0 < 0.005 && ncx1 > 0.995 && ncy1 > 0.995;

  return {
    bbox: [
      +(newCx - newW / 2).toFixed(2),
      +(newCy - newH / 2).toFixed(2),
      +(newCx + newW / 2).toFixed(2),
      +(newCy + newH / 2).toFixed(2),
    ],
    crop: isFull
      ? null
      : [
          +ncx0.toFixed(4),
          +ncy0.toFixed(4),
          +ncx1.toFixed(4),
          +ncy1.toFixed(4),
        ],
  };
}

export function normalizeAngle(deg: number): number {
  let a = (((deg + 180) % 360) + 360) % 360 - 180;
  if (a === -180 && deg > 0) a = 180;
  return Math.round(a);
}
