import type React from "react";
import { cn } from "@/lib/utils";
import type { ImageOverlay } from "@/types";
import {
  type CropBox,
  type CropHandle,
  type HandleCorner,
  getFullImageGeometry,
  imageSrcFor,
} from "./geometry";

interface CropModeOverlayProps {
  overlay: ImageOverlay;
  draftCrop: CropBox;
  zoom: number;
  onStartCropDrag: (
    e: React.PointerEvent,
    overlay: ImageOverlay,
    handle: CropHandle,
  ) => void;
}

export function CropModeOverlay({
  overlay,
  draftCrop,
  zoom,
  onStartCropDrag,
}: CropModeOverlayProps) {
  const { fullX0, fullY0, fullW, fullH } = getFullImageGeometry(overlay);
  const [cx0, cy0, cx1, cy1] = draftCrop;
  const src = imageSrcFor(overlay);

  return (
    <div
      data-overlay-id={overlay.id}
      data-overlay-kind="image"
      data-crop-mode="true"
      onMouseDown={(e) => e.stopPropagation()}
      className="pdf-overlay absolute z-18 select-none"
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
        <div className="pointer-events-none absolute inset-x-0 top-1/3 border-t border-white/60" />
        <div className="pointer-events-none absolute inset-x-0 top-2/3 border-t border-white/60" />
        <div className="pointer-events-none absolute inset-y-0 left-1/3 border-l border-white/60" />
        <div className="pointer-events-none absolute inset-y-0 left-2/3 border-l border-white/60" />

        {(["nw", "ne", "sw", "se"] as HandleCorner[]).map((corner) => (
          <div
            key={corner}
            data-crop-handle={corner}
            onPointerDown={(e) => onStartCropDrag(e, overlay, corner)}
            className={cn(
              "absolute h-3 w-3 rounded-xs border-2 border-blue-600 bg-white shadow-xs",
              corner === "nw" && "-top-1.5 -left-1.5 cursor-nwse-resize",
              corner === "ne" && "-top-1.5 -right-1.5 cursor-nesw-resize",
              corner === "sw" && "-bottom-1.5 -left-1.5 cursor-nesw-resize",
              corner === "se" && "-right-1.5 -bottom-1.5 cursor-nwse-resize",
            )}
          />
        ))}

        <div
          data-crop-handle="n"
          onPointerDown={(e) => onStartCropDrag(e, overlay, "n")}
          className="absolute -top-1 left-1/2 h-2 w-6 -translate-x-1/2 cursor-ns-resize rounded-full border border-blue-600 bg-white"
        />
        <div
          data-crop-handle="s"
          onPointerDown={(e) => onStartCropDrag(e, overlay, "s")}
          className="absolute -bottom-1 left-1/2 h-2 w-6 -translate-x-1/2 cursor-ns-resize rounded-full border border-blue-600 bg-white"
        />
        <div
          data-crop-handle="w"
          onPointerDown={(e) => onStartCropDrag(e, overlay, "w")}
          className="absolute top-1/2 -left-1 h-6 w-2 -translate-y-1/2 cursor-ew-resize rounded-full border border-blue-600 bg-white"
        />
        <div
          data-crop-handle="e"
          onPointerDown={(e) => onStartCropDrag(e, overlay, "e")}
          className="absolute top-1/2 -right-1 h-6 w-2 -translate-y-1/2 cursor-ew-resize rounded-full border border-blue-600 bg-white"
        />
      </div>
    </div>
  );
}
