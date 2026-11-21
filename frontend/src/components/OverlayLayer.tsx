import { useRef, useState } from "react";
import type React from "react";
import { CropModeOverlay } from "@/features/editor/overlay-layer/CropModeOverlay";
import {
  type CropBox,
  clampPt,
  computeCroppedPatch,
  getFullImageGeometry,
} from "@/features/editor/overlay-layer/geometry";
import { OverlayItem } from "@/features/editor/overlay-layer/OverlayItem";
import {
  trackPointerDrag,
  useOverlayInteractions,
} from "@/features/editor/overlay-layer/useOverlayInteractions";
import type { ImageOverlay, PageOverlay, ToolMode } from "@/types";

export { computeCroppedPatch, getFullImageGeometry, type CropBox };

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
  const drawLayerRef = useRef<HTMLDivElement | null>(null);
  const [drawBox, setDrawBox] = useState<
    [number, number, number, number] | null
  >(null);

  const {
    dragState,
    rotateState,
    startMove,
    startResize,
    startRotate,
    startCropDrag,
  } = useOverlayInteractions({
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
  });

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

    trackPointerDrag(
      (ev) => {
        const cx = clampPt((ev.clientX - rect.left) / zoom, pageWidthPt);
        const cy = clampPt((ev.clientY - rect.top) / zoom, pageHeightPt);
        current = [
          +Math.min(sx, cx).toFixed(2),
          +Math.min(sy, cy).toFixed(2),
          +Math.max(sx, cx).toFixed(2),
          +Math.max(sy, cy).toFixed(2),
        ];
        setDrawBox(current);
      },
      () => {
        setDrawBox(null);
        if (current[2] - current[0] >= 6 && current[3] - current[1] >= 6) {
          onCreateWhiteout(current);
        }
      },
    );
  };

  return (
    <>
      {overlays.map((overlay) => {
        if (
          overlay.kind === "image" &&
          croppingOverlayId === overlay.id &&
          draftCrop !== null
        ) {
          return (
            <CropModeOverlay
              key={overlay.id}
              overlay={overlay}
              draftCrop={draftCrop}
              zoom={zoom}
              onStartCropDrag={startCropDrag}
            />
          );
        }

        const bbox =
          dragState && dragState.id === overlay.id
            ? dragState.bbox
            : overlay.bbox;
        const activeAngle =
          overlay.kind === "image"
            ? rotateState && rotateState.id === overlay.id
              ? rotateState.angleDeg
              : overlay.angle_deg
            : 0;
        const isRotating =
          overlay.kind === "image" &&
          rotateState !== null &&
          rotateState.id === overlay.id;

        return (
          <OverlayItem
            key={overlay.id}
            overlay={overlay}
            bbox={bbox}
            activeAngle={activeAngle}
            isSelected={overlay.id === selectedOverlayId}
            isRotating={isRotating}
            zoom={zoom}
            toolMode={toolMode}
            showBoxes={showBoxes}
            onStartMove={startMove}
            onStartResize={startResize}
            onStartRotate={startRotate}
            onStartCrop={onStartCrop}
          />
        );
      })}

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
