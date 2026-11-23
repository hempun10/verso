import { useState } from "react";
import type React from "react";
import type { ImageOverlay, PageOverlay, ToolMode } from "@/types";
import {
  type CropBox,
  type CropHandle,
  type HandleCorner,
  MIN_CROP_FRAC,
  MIN_SIZE_PT,
  SNAP_ANGLES,
  clampPt,
  getFullImageGeometry,
  normalizeAngle,
} from "./geometry";

interface UseOverlayInteractionsArgs {
  pageWidthPt: number;
  pageHeightPt: number;
  zoom: number;
  toolMode: ToolMode;
  croppingOverlayId: string | null;
  draftCrop: CropBox | null;
  onSelectOverlay: (id: string) => void;
  onChangeDraftCrop: (next: CropBox) => void;
  onCommitBbox: (id: string, bbox: [number, number, number, number]) => void;
  onCommitAngle: (id: string, angleDeg: number) => void;
}

export function trackPointerDrag(
  onMove: (ev: PointerEvent) => void,
  onEnd: () => void,
) {
  const handleUp = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", handleUp);
    onEnd();
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", handleUp);
}

export function useOverlayInteractions({
  pageWidthPt,
  pageHeightPt,
  zoom,
  toolMode,
  croppingOverlayId,
  draftCrop,
  onSelectOverlay,
  onChangeDraftCrop,
  onCommitBbox,
  onCommitAngle,
}: UseOverlayInteractionsArgs) {
  const [dragState, setDragState] = useState<{
    id: string;
    bbox: [number, number, number, number];
  } | null>(null);
  const [rotateState, setRotateState] = useState<{
    id: string;
    angleDeg: number;
  } | null>(null);

  const startMove = (e: React.PointerEvent, overlay: PageOverlay) => {
    if (
      e.button !== 0 ||
      toolMode === "whiteout" ||
      croppingOverlayId === overlay.id
    ) {
      return;
    }
    e.stopPropagation();
    e.preventDefault();
    onSelectOverlay(overlay.id);

    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const [ix0, iy0, ix1, iy1] = overlay.bbox;
    const w = ix1 - ix0;
    const h = iy1 - iy0;
    let latest: [number, number, number, number] = [ix0, iy0, ix1, iy1];
    let moved = false;

    trackPointerDrag(
      (ev) => {
        const dxPt = (ev.clientX - startClientX) / zoom;
        const dyPt = (ev.clientY - startClientY) / zoom;
        if (!moved && Math.hypot(dxPt, dyPt) > 0.5) moved = true;
        const nx0 = clampPt(ix0 + dxPt, Math.max(0, pageWidthPt - w));
        const ny0 = clampPt(iy0 + dyPt, Math.max(0, pageHeightPt - h));
        latest = [
          +nx0.toFixed(2),
          +ny0.toFixed(2),
          +(nx0 + w).toFixed(2),
          +(ny0 + h).toFixed(2),
        ];
        setDragState({ id: overlay.id, bbox: latest });
      },
      () => {
        setDragState(null);
        if (moved) onCommitBbox(overlay.id, latest);
      },
    );
  };

  const startResize = (
    e: React.PointerEvent,
    overlay: PageOverlay,
    corner: HandleCorner,
  ) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();

    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const [ix0, iy0, ix1, iy1] = overlay.bbox;
    const aspect =
      Math.max(MIN_SIZE_PT, ix1 - ix0) / Math.max(MIN_SIZE_PT, iy1 - iy0);
    let latest: [number, number, number, number] = [ix0, iy0, ix1, iy1];
    let resized = false;

    trackPointerDrag(
      (ev) => {
        const dxPt = (ev.clientX - startClientX) / zoom;
        const dyPt = (ev.clientY - startClientY) / zoom;
        resized = true;
        let x0 = ix0;
        let y0 = iy0;
        let x1 = ix1;
        let y1 = iy1;

        if (corner === "nw" || corner === "sw") {
          x0 = Math.min(ix1 - MIN_SIZE_PT, clampPt(ix0 + dxPt, pageWidthPt));
        } else {
          x1 = Math.max(ix0 + MIN_SIZE_PT, clampPt(ix1 + dxPt, pageWidthPt));
        }
        if (corner === "nw" || corner === "ne") {
          y0 = Math.min(iy1 - MIN_SIZE_PT, clampPt(iy0 + dyPt, pageHeightPt));
        } else {
          y1 = Math.max(iy0 + MIN_SIZE_PT, clampPt(iy1 + dyPt, pageHeightPt));
        }

        if (overlay.kind === "image" && !ev.shiftKey) {
          const lockedH = Math.max(
            MIN_SIZE_PT,
            Math.max(MIN_SIZE_PT, x1 - x0) / aspect,
          );
          if (corner === "nw" || corner === "ne") y0 = Math.max(0, y1 - lockedH);
          else y1 = Math.min(pageHeightPt, y0 + lockedH);
        }

        latest = [+x0.toFixed(2), +y0.toFixed(2), +x1.toFixed(2), +y1.toFixed(2)];
        setDragState({ id: overlay.id, bbox: latest });
      },
      () => {
        setDragState(null);
        if (resized) onCommitBbox(overlay.id, latest);
      },
    );
  };

  const startRotate = (e: React.PointerEvent, overlay: ImageOverlay) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();

    const boxEl = (e.currentTarget as HTMLElement).closest(
      "[data-overlay-id]",
    ) as HTMLElement | null;
    if (!boxEl) return;
    const rect = boxEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const startPointerAngle =
      (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI;
    const startOverlayAngle = overlay.angle_deg;
    let latestAngle = startOverlayAngle;
    let rotated = false;

    setRotateState({ id: overlay.id, angleDeg: startOverlayAngle });

    trackPointerDrag(
      (ev) => {
        const currAngle =
          (Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180) / Math.PI;
        let next = normalizeAngle(
          startOverlayAngle + (currAngle - startPointerAngle),
        );
        if (ev.shiftKey) {
          next = Math.round(next / 15) * 15;
        } else {
          const snapped = SNAP_ANGLES.find((s) => Math.abs(next - s) <= 3);
          if (snapped !== undefined) next = snapped;
        }
        if (next !== latestAngle) rotated = true;
        latestAngle = next;
        setRotateState({ id: overlay.id, angleDeg: next });
      },
      () => {
        setRotateState(null);
        if (rotated) onCommitAngle(overlay.id, latestAngle);
      },
    );
  };

  const startCropDrag = (
    e: React.PointerEvent,
    overlay: ImageOverlay,
    handle: CropHandle,
  ) => {
    if (e.button !== 0 || !draftCrop) return;
    e.stopPropagation();
    e.preventDefault();

    const { fullW, fullH } = getFullImageGeometry(overlay);
    const fullWPx = Math.max(1, fullW * zoom);
    const fullHPx = Math.max(1, fullH * zoom);
    const startX = e.clientX;
    const startY = e.clientY;
    const [icx0, icy0, icx1, icy1] = draftCrop;
    const rad = -(overlay.angle_deg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    trackPointerDrag(
      (ev) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        const dfx = (dx * cos - dy * sin) / fullWPx;
        const dfy = (dx * sin + dy * cos) / fullHPx;
        let cx0 = icx0;
        let cy0 = icy0;
        let cx1 = icx1;
        let cy1 = icy1;

        if (handle === "w" || handle === "nw" || handle === "sw") {
          cx0 = Math.max(0, Math.min(icx1 - MIN_CROP_FRAC, icx0 + dfx));
        }
        if (handle === "e" || handle === "ne" || handle === "se") {
          cx1 = Math.min(1, Math.max(icx0 + MIN_CROP_FRAC, icx1 + dfx));
        }
        if (handle === "n" || handle === "nw" || handle === "ne") {
          cy0 = Math.max(0, Math.min(icy1 - MIN_CROP_FRAC, icy0 + dfy));
        }
        if (handle === "s" || handle === "sw" || handle === "se") {
          cy1 = Math.min(1, Math.max(icy0 + MIN_CROP_FRAC, icy1 + dfy));
        }
        onChangeDraftCrop([cx0, cy0, cx1, cy1]);
      },
      () => {},
    );
  };

  return {
    dragState,
    rotateState,
    startMove,
    startResize,
    startRotate,
    startCropDrag,
  };
}
