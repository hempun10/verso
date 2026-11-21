import { useRef, useState } from "react";
import type React from "react";
import { useEditor } from "@/features/editor/EditorContext";
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

export { computeCroppedPatch, getFullImageGeometry, type CropBox };

export function OverlayLayer() {
  const { zoom, session, actions } = useEditor();
  const drawLayerRef = useRef<HTMLDivElement | null>(null);
  const [drawBox, setDrawBox] = useState<
    [number, number, number, number] | null
  >(null);

  const pageWidthPt = session.currentPage?.width_pt ?? 612;
  const pageHeightPt = session.currentPage?.height_pt ?? 792;

  const handleSelectOverlay = (id: string) => {
    if (actions.croppingOverlayId && actions.croppingOverlayId !== id) {
      actions.handleApplyCrop();
    }
    if (actions.selectedBlock) {
      actions.skippedBlurBlockIdRef.current = actions.selectedBlock.id;
      actions.commitRuns(actions.selectedBlock, actions.draftRunsRef.current);
      actions.setSelectedId(null);
    }
    actions.setSelectedOverlayId(id);
  };

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
    toolMode: actions.toolMode,
    croppingOverlayId: actions.croppingOverlayId,
    draftCrop: actions.draftCrop,
    onSelectOverlay: handleSelectOverlay,
    onChangeDraftCrop: actions.setDraftCrop,
    onCommitBbox: (id, bbox) => actions.handleUpdateOverlay(id, { bbox }),
    onCommitAngle: (id, angleDeg) =>
      actions.handleUpdateOverlay(id, { angle_deg: angleDeg }),
  });

  const handleDrawStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || actions.toolMode !== "whiteout") return;
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
          actions.handleCreateWhiteout(current);
        }
      },
    );
  };

  const itemHandlers = {
    onStartMove: startMove,
    onStartResize: startResize,
    onStartRotate: startRotate,
  };

  return (
    <>
      {session.pageOverlays.map((overlay) => {
        if (
          overlay.kind === "image" &&
          actions.croppingOverlayId === overlay.id &&
          actions.draftCrop !== null
        ) {
          return (
            <CropModeOverlay
              key={overlay.id}
              overlay={overlay}
              draftCrop={actions.draftCrop}
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
            isRotating={isRotating}
            handlers={itemHandlers}
          />
        );
      })}

      {actions.toolMode === "whiteout" && (
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
