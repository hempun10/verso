import { useRef, useState } from "react";
import { RotateCw } from "lucide-react";
import { apiUrl } from "@/api";
import { cn } from "@/lib/utils";
import type { ImageOverlay, PageOverlay, ToolMode } from "@/types";

type HandleCorner = "nw" | "ne" | "sw" | "se";
type CropHandle = HandleCorner | "n" | "s" | "e" | "w";

export type CropBox = [number, number, number, number];

const MIN_SIZE_PT = 12;
const MIN_CROP_FRAC = 0.06;
const SNAP_ANGLES = [-180, -135, -90, -45, 0, 45, 90, 135, 180];

function imageSrcFor(overlay: ImageOverlay): string {
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

function normalizeAngle(deg: number): number {
  let a = ((deg + 180) % 360 + 360) % 360 - 180;
  if (a === -180 && deg > 0) a = 180;
  return Math.round(a);
}

interface OverlayLayerProps {
  overlays: PageOverlay[];
  pageWidthPt: number;
  pageHeightPt: number;
  zoom: number;
  toolMode: ToolMode;
  showBoxes: boolean;
  selectedOverlayId: string | null;
  croppingOverlayId: string | null;
  draftCrop: CropBox | null;
  onSelectOverlay: (id: string) => void;
  onStartCrop: (overlay: ImageOverlay) => void;
  onChangeDraftCrop: (next: CropBox) => void;
  onCreateWhiteout: (bbox: [number, number, number, number]) => void;
  onCommitBbox: (id: string, bbox: [number, number, number, number]) => void;
  onCommitAngle: (id: string, angleDeg: number) => void;
}

export function OverlayLayer({
  overlays,
  pageWidthPt,
  pageHeightPt,
  zoom,
  toolMode,
  showBoxes,
  selectedOverlayId,
  croppingOverlayId,
  draftCrop,
  onSelectOverlay,
  onStartCrop,
  onChangeDraftCrop,
  onCreateWhiteout,
  onCommitBbox,
  onCommitAngle,
}: OverlayLayerProps) {
  const [drawBox, setDrawBox] = useState<
    [number, number, number, number] | null
  >(null);
  const [dragState, setDragState] = useState<{
    id: string;
    bbox: [number, number, number, number];
  } | null>(null);
  const [rotateState, setRotateState] = useState<{
    id: string;
    angleDeg: number;
  } | null>(null);
  const drawLayerRef = useRef<HTMLDivElement | null>(null);

  const clampPt = (val: number, max: number) =>
    Math.max(0, Math.min(max, val));

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

    const onPointerMove = (ev: PointerEvent) => {
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
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      setDragState(null);
      if (moved) {
        onCommitBbox(overlay.id, latest);
      }
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
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
    const origW = Math.max(MIN_SIZE_PT, ix1 - ix0);
    const origH = Math.max(MIN_SIZE_PT, iy1 - iy0);
    const aspect = origW / origH;
    let latest: [number, number, number, number] = [ix0, iy0, ix1, iy1];
    let resized = false;

    const onPointerMove = (ev: PointerEvent) => {
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
        const nextW = Math.max(MIN_SIZE_PT, x1 - x0);
        const lockedH = Math.max(MIN_SIZE_PT, nextW / aspect);
        if (corner === "nw" || corner === "ne") {
          y0 = Math.max(0, y1 - lockedH);
        } else {
          y1 = Math.min(pageHeightPt, y0 + lockedH);
        }
      }

      latest = [
        +x0.toFixed(2),
        +y0.toFixed(2),
        +x1.toFixed(2),
        +y1.toFixed(2),
      ];
      setDragState({ id: overlay.id, bbox: latest });
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      setDragState(null);
      if (resized) {
        onCommitBbox(overlay.id, latest);
      }
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
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

    const onPointerMove = (ev: PointerEvent) => {
      const currAngle =
        (Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180) / Math.PI;
      let next = normalizeAngle(
        startOverlayAngle + (currAngle - startPointerAngle),
      );
      if (ev.shiftKey) {
        next = Math.round(next / 15) * 15;
      } else {
        for (const snap of SNAP_ANGLES) {
          if (Math.abs(next - snap) <= 3) {
            next = snap;
            break;
          }
        }
      }
      if (next !== latestAngle) rotated = true;
      latestAngle = next;
      setRotateState({ id: overlay.id, angleDeg: next });
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      setRotateState(null);
      if (rotated) {
        onCommitAngle(overlay.id, latestAngle);
      }
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
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

    const onPointerMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      // Map screen delta into the image's local unrotated axis.
      const localDx = dx * cos - dy * sin;
      const localDy = dx * sin + dy * cos;
      const dfx = localDx / fullWPx;
      const dfy = localDy / fullHPx;

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
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const handleDrawStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || toolMode !== "whiteout") return;
    e.stopPropagation();
    e.preventDefault();
    const rect = drawLayerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const sx = clampPt((e.clientX - rect.left) / zoom, pageWidthPt);
    const sy = clampPt((e.clientY - rect.top) / zoom, pageHeightPt);
    let current: [number, number, number, number] = [sx, sy, sx, sy];
    setDrawBox(current);

    const onPointerMove = (ev: PointerEvent) => {
      const cx = clampPt((ev.clientX - rect.left) / zoom, pageWidthPt);
      const cy = clampPt((ev.clientY - rect.top) / zoom, pageHeightPt);
      current = [
        +Math.min(sx, cx).toFixed(2),
        +Math.min(sy, cy).toFixed(2),
        +Math.max(sx, cx).toFixed(2),
        +Math.max(sy, cy).toFixed(2),
      ];
      setDrawBox(current);
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      setDrawBox(null);
      if (current[2] - current[0] >= 6 && current[3] - current[1] >= 6) {
        onCreateWhiteout(current);
      }
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  return (
    <>
      {overlays.map((overlay) => {
        const isCroppingThis =
          overlay.kind === "image" &&
          croppingOverlayId === overlay.id &&
          draftCrop !== null;

        // Interactive Crop Mode rendering for the currently cropping image
        if (isCroppingThis) {
          const { fullX0, fullY0, fullW, fullH } =
            getFullImageGeometry(overlay);
          const [cx0, cy0, cx1, cy1] = draftCrop;
          const src = imageSrcFor(overlay);

          return (
            <div
              key={overlay.id}
              data-overlay-id={overlay.id}
              data-overlay-kind="image"
              data-crop-mode="true"
              onMouseDown={(e) => e.stopPropagation()}
              className="pdf-overlay absolute z-[18] select-none"
              style={{
                left: fullX0 * zoom,
                top: fullY0 * zoom,
                width: Math.max(4, fullW * zoom),
                height: Math.max(4, fullH * zoom),
                transform:
                  overlay.angle_deg !== 0
                    ? `rotate(${overlay.angle_deg}deg)`
                    : undefined,
              }}
            >
              {/* Dimmed full original image behind crop window */}
              <img
                src={src}
                alt="Uncropped source"
                draggable={false}
                className="pointer-events-none h-full w-full object-fill opacity-30 select-none"
              />

              {/* Bright clipped preview of the active crop region */}
              <div
                className="pointer-events-none absolute inset-0 overflow-hidden"
                style={{
                  clipPath: `inset(${cy0 * 100}% ${(1 - cx1) * 100}% ${(1 - cy1) * 100}% ${cx0 * 100}%)`,
                }}
              >
                <img
                  src={src}
                  alt="Cropped preview"
                  draggable={false}
                  className="h-full w-full object-fill select-none"
                  style={{ opacity: overlay.opacity }}
                />
              </div>

              {/* Active crop frame + rule-of-thirds grid + 8 handles */}
              <div
                data-crop-frame="true"
                className="absolute border-2 border-blue-600 shadow-sm"
                style={{
                  left: `${cx0 * 100}%`,
                  top: `${cy0 * 100}%`,
                  width: `${(cx1 - cx0) * 100}%`,
                  height: `${(cy1 - cy0) * 100}%`,
                }}
              >
                {/* Rule-of-thirds guides */}
                <div className="pointer-events-none absolute inset-x-0 top-1/3 border-t border-white/60" />
                <div className="pointer-events-none absolute inset-x-0 top-2/3 border-t border-white/60" />
                <div className="pointer-events-none absolute inset-y-0 left-1/3 border-l border-white/60" />
                <div className="pointer-events-none absolute inset-y-0 left-2/3 border-l border-white/60" />

                {/* 4 corner crop handles */}
                {(["nw", "ne", "sw", "se"] as HandleCorner[]).map((corner) => (
                  <div
                    key={corner}
                    data-crop-handle={corner}
                    onPointerDown={(e) => startCropDrag(e, overlay, corner)}
                    className={cn(
                      "absolute h-3 w-3 rounded-xs border-2 border-blue-600 bg-white shadow-xs",
                      corner === "nw" && "-top-1.5 -left-1.5 cursor-nwse-resize",
                      corner === "ne" && "-top-1.5 -right-1.5 cursor-nesw-resize",
                      corner === "sw" && "-bottom-1.5 -left-1.5 cursor-nesw-resize",
                      corner === "se" && "-right-1.5 -bottom-1.5 cursor-nwse-resize",
                    )}
                  />
                ))}

                {/* 4 edge crop bars */}
                <div
                  data-crop-handle="n"
                  onPointerDown={(e) => startCropDrag(e, overlay, "n")}
                  className="absolute -top-1 left-1/2 h-2 w-6 -translate-x-1/2 cursor-ns-resize rounded-full border border-blue-600 bg-white"
                />
                <div
                  data-crop-handle="s"
                  onPointerDown={(e) => startCropDrag(e, overlay, "s")}
                  className="absolute -bottom-1 left-1/2 h-2 w-6 -translate-x-1/2 cursor-ns-resize rounded-full border border-blue-600 bg-white"
                />
                <div
                  data-crop-handle="w"
                  onPointerDown={(e) => startCropDrag(e, overlay, "w")}
                  className="absolute top-1/2 -left-1 h-6 w-2 -translate-y-1/2 cursor-ew-resize rounded-full border border-blue-600 bg-white"
                />
                <div
                  data-crop-handle="e"
                  onPointerDown={(e) => startCropDrag(e, overlay, "e")}
                  className="absolute top-1/2 -right-1 h-6 w-2 -translate-y-1/2 cursor-ew-resize rounded-full border border-blue-600 bg-white"
                />
              </div>
            </div>
          );
        }

        const bbox =
          dragState && dragState.id === overlay.id
            ? dragState.bbox
            : overlay.bbox;
        const [x0, y0, x1, y1] = bbox;
        const isSelected = overlay.id === selectedOverlayId;
        const widthPx = Math.max(4, (x1 - x0) * zoom);
        const heightPx = Math.max(4, (y1 - y0) * zoom);
        const activeAngle =
          overlay.kind === "image"
            ? rotateState && rotateState.id === overlay.id
              ? rotateState.angleDeg
              : overlay.angle_deg
            : 0;
        const isRotatingThis =
          overlay.kind === "image" &&
          rotateState !== null &&
          rotateState.id === overlay.id;

        const crop = overlay.kind === "image" ? overlay.crop : null;
        const cw = crop ? Math.max(0.01, crop[2] - crop[0]) : 1;
        const ch = crop ? Math.max(0.01, crop[3] - crop[1]) : 1;

        return (
          <div
            key={overlay.id}
            data-overlay-id={overlay.id}
            data-overlay-kind={overlay.kind}
            onPointerDown={(e) => startMove(e, overlay)}
            onDoubleClick={(e) => {
              if (overlay.kind === "image" && toolMode === "select") {
                e.stopPropagation();
                onStartCrop(overlay);
              }
            }}
            className={cn(
              "pdf-overlay absolute select-none",
              toolMode === "whiteout" ? "pointer-events-none" : "cursor-move",
              isSelected
                ? "z-[15] ring-2 ring-blue-600"
                : overlay.kind === "whiteout"
                  ? showBoxes
                    ? "z-[8] border border-dashed border-zinc-400/80 hover:border-blue-500"
                    : "z-[8] hover:ring-1 hover:ring-blue-500/70"
                  : "z-[9] hover:ring-1 hover:ring-blue-500/80",
            )}
            style={{
              left: x0 * zoom,
              top: y0 * zoom,
              width: widthPx,
              height: heightPx,
              borderRadius:
                overlay.kind === "whiteout" && overlay.shape === "ellipse"
                  ? "9999px"
                  : "2px",
              backgroundColor:
                overlay.kind === "whiteout" ? overlay.fill_hex : "transparent",
              transform:
                overlay.kind === "image" && activeAngle !== 0
                  ? `rotate(${activeAngle}deg)`
                  : undefined,
            }}
          >
            {overlay.kind === "image" && (
              <div className="relative h-full w-full overflow-hidden">
                <img
                  src={imageSrcFor(overlay)}
                  alt="PDF image overlay"
                  draggable={false}
                  className="pointer-events-none absolute max-w-none object-fill select-none"
                  style={{
                    opacity: overlay.opacity,
                    width: `${(1 / cw) * 100}%`,
                    height: `${(1 / ch) * 100}%`,
                    left: crop ? `${-(crop[0] / cw) * 100}%` : "0%",
                    top: crop ? `${-(crop[1] / ch) * 100}%` : "0%",
                  }}
                />
              </div>
            )}

            {/* Selection chrome: 4 corner resize handles + top rotate handle (images) */}
            {isSelected && toolMode === "select" && (
              <>
                {overlay.kind === "image" && (
                  <div className="absolute -top-8 left-1/2 flex -translate-x-1/2 flex-col items-center">
                    <button
                      type="button"
                      aria-label="Drag to rotate image"
                      data-rotate-handle="true"
                      onPointerDown={(e) => startRotate(e, overlay)}
                      className="flex h-5 w-5 cursor-grab items-center justify-center rounded-full border border-blue-600 bg-white text-blue-600 shadow-xs transition-colors hover:bg-blue-50 active:cursor-grabbing"
                    >
                      <RotateCw className="h-3 w-3" />
                    </button>
                    <div className="h-3 w-px bg-blue-600" />
                    {isRotatingThis && (
                      <div className="pointer-events-none absolute -top-7 rounded-md bg-zinc-900 px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap text-white shadow-sm tabular-nums">
                        {Math.round(activeAngle)}°
                      </div>
                    )}
                  </div>
                )}

                {(["nw", "ne", "sw", "se"] as HandleCorner[]).map((corner) => (
                  <div
                    key={corner}
                    data-resize-handle={corner}
                    onPointerDown={(e) => startResize(e, overlay, corner)}
                    className={cn(
                      "absolute h-2.5 w-2.5 rounded-full border-2 border-blue-600 bg-white shadow-xs",
                      corner === "nw" && "-top-1.5 -left-1.5 cursor-nwse-resize",
                      corner === "ne" && "-top-1.5 -right-1.5 cursor-nesw-resize",
                      corner === "sw" && "-bottom-1.5 -left-1.5 cursor-nesw-resize",
                      corner === "se" && "-right-1.5 -bottom-1.5 cursor-nwse-resize",
                    )}
                  />
                ))}
              </>
            )}
          </div>
        );
      })}

      {/* Crosshair drawing surface when Whiteout draw mode is active */}
      {toolMode === "whiteout" && (
        <div
          ref={drawLayerRef}
          data-whiteout-draw-layer="true"
          onPointerDown={handleDrawStart}
          className="absolute inset-0 z-20 cursor-crosshair"
        >
          {drawBox && (
            <div
              className="pointer-events-none absolute border-2 border-dashed border-blue-600 bg-white/90 shadow-xs"
              style={{
                left: drawBox[0] * zoom,
                top: drawBox[1] * zoom,
                width: Math.max(2, (drawBox[2] - drawBox[0]) * zoom),
                height: Math.max(2, (drawBox[3] - drawBox[1]) * zoom),
              }}
            />
          )}
        </div>
      )}
    </>
  );
}
