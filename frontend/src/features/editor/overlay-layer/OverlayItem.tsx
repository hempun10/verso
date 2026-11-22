import type React from "react";
import { RotateCw } from "lucide-react";
import { useEditor } from "@/features/editor/EditorContext";
import { cn } from "@/lib/utils";
import type { ImageOverlay, PageOverlay } from "@/types";
import { type HandleCorner, imageSrcFor } from "./geometry";

export interface OverlayItemHandlers {
  onStartMove: (e: React.PointerEvent, overlay: PageOverlay) => void;
  onStartResize: (
    e: React.PointerEvent,
    overlay: PageOverlay,
    corner: HandleCorner,
  ) => void;
  onStartRotate: (e: React.PointerEvent, overlay: ImageOverlay) => void;
}

interface OverlayItemProps {
  overlay: PageOverlay;
  bbox: [number, number, number, number];
  activeAngle: number;
  isRotating: boolean;
  handlers: OverlayItemHandlers;
}

export function OverlayItem({
  overlay,
  bbox,
  activeAngle,
  isRotating,
  handlers,
}: OverlayItemProps) {
  const { zoom, showBoxes, actions } = useEditor();
  const isSelected = overlay.id === actions.selectedOverlayId;
  const { toolMode, handleStartCrop } = actions;

  const [x0, y0, x1, y1] = bbox;
  const widthPx = Math.max(4, (x1 - x0) * zoom);
  const heightPx = Math.max(4, (y1 - y0) * zoom);

  const crop = overlay.kind === "image" ? overlay.crop : null;
  const cw = crop ? Math.max(0.01, crop[2] - crop[0]) : 1;
  const ch = crop ? Math.max(0.01, crop[3] - crop[1]) : 1;

  return (
    <div
      data-overlay-id={overlay.id}
      data-overlay-kind={overlay.kind}
      onPointerDown={(e) => handlers.onStartMove(e, overlay)}
      onDoubleClick={(e) => {
        if (overlay.kind === "image" && toolMode === "select") {
          e.stopPropagation();
          handleStartCrop(overlay);
        }
      }}
      className={cn(
        "pdf-overlay absolute select-none",
        toolMode === "whiteout" ? "pointer-events-none" : "cursor-move",
        isSelected
          ? "z-15 ring-2 ring-blue-600"
          : overlay.kind === "whiteout"
            ? showBoxes
              ? "z-8 border border-dashed border-zinc-400/80 hover:border-blue-500"
              : "z-8 hover:ring-1 hover:ring-blue-500/70"
            : "z-9 hover:ring-1 hover:ring-blue-500/80",
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
            alt="Image overlay"
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

      {isSelected && toolMode === "select" && (
        <>
          {overlay.kind === "image" && (
            <div className="absolute -top-8 left-1/2 flex -translate-x-1/2 flex-col items-center">
              <button
                type="button"
                aria-label="Drag to rotate image"
                data-rotate-handle="true"
                onPointerDown={(e) => handlers.onStartRotate(e, overlay)}
                className="flex h-5 w-5 cursor-grab items-center justify-center rounded-full border border-blue-600 bg-white text-blue-600 shadow-xs transition-colors hover:bg-blue-50 active:cursor-grabbing"
              >
                <RotateCw className="h-3 w-3" />
              </button>
              <div className="h-3 w-px bg-blue-600" />
              {isRotating && (
                <div className="pointer-events-none absolute -top-7 rounded-md bg-zinc-900 px-1.5 py-0.5 text-2xs font-medium whitespace-nowrap text-white shadow-sm tabular-nums">
                  {Math.round(activeAngle)}°
                </div>
              )}
            </div>
          )}

          {(["nw", "ne", "sw", "se"] as HandleCorner[]).map((corner) => (
            <div
              key={corner}
              data-resize-handle={corner}
              onPointerDown={(e) => handlers.onStartResize(e, overlay, corner)}
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
}
