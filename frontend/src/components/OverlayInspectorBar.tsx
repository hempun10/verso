import { Check, Circle, Copy, Crop, Square, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ColorSwatchPicker } from "@/components/ui/color-swatch-picker";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useEditor } from "@/features/editor/EditorContext";
import { ImageInspectorControls } from "@/features/editor/ImageInspectorControls";

const WHITEOUT_SWATCHES = [
  { hex: "#ffffff", label: "Pure White" },
  { hex: "#fafafa", label: "Off-White" },
  { hex: "#fdfbf7", label: "Warm Paper" },
  { hex: "#f4f4f5", label: "Light Gray" },
  { hex: "#e4e4e7", label: "Muted Gray" },
  { hex: "#000000", label: "Blackout" },
] as const;

export function OverlayInspectorBar() {
  const { actions } = useEditor();
  const overlay = actions.selectedOverlay;
  if (!overlay) return null;

  const isCropping = actions.croppingOverlayId === overlay.id;

  if (overlay.kind === "image" && isCropping) {
    return (
      <div
        className="inspector-bar fixed top-16.5 left-1/2 z-30 flex w-max max-w-[calc(100vw-24px)] -translate-x-1/2 items-center gap-1.5 rounded-xl border border-input bg-popover px-2.5 py-1.5 shadow-floating"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <Badge variant="default" className="gap-1 px-2 py-0.5 text-label">
          <Crop className="h-3 w-3" />
          Crop image
        </Badge>
        <span className="px-1 text-xs text-muted-foreground">
          Drag edges or corners · Enter to apply
        </span>
        <Separator orientation="vertical" className="mx-0.5 h-5" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="Reset crop"
          className="h-7 px-2 text-xs"
          onClick={actions.handleResetCrop}
        >
          Reset
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label="Cancel crop"
          className="h-7 gap-1 px-2 text-xs"
          onClick={actions.handleCancelCrop}
        >
          <X className="h-3.5 w-3.5" />
          Cancel
        </Button>
        <Button
          type="button"
          variant="default"
          size="sm"
          aria-label="Apply crop"
          className="h-7 gap-1 px-2.5 text-xs"
          onClick={actions.handleApplyCrop}
        >
          <Check className="h-3.5 w-3.5" />
          Done
        </Button>
      </div>
    );
  }

  return (
    <div
      className="inspector-bar fixed top-16.5 left-1/2 z-30 flex w-max max-w-[calc(100vw-24px)] -translate-x-1/2 flex-wrap items-center gap-1.5 rounded-xl border border-input bg-popover px-2.5 py-1.5 shadow-floating"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {overlay.kind === "whiteout" ? (
        <>
          <Badge variant="secondary" className="gap-1 px-2 py-0.5 text-label">
            <Square className="h-3 w-3" />
            Whiteout
          </Badge>
          <Separator orientation="vertical" className="mx-0.5 h-5" />
          <div
            className="flex items-center gap-0.5 rounded-lg bg-accent p-0.5"
            role="group"
            aria-label="Whiteout shape"
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon-sm"
                  variant={overlay.shape === "rect" ? "default" : "ghost"}
                  aria-label="Rectangle shape"
                  aria-pressed={overlay.shape === "rect"}
                  className="h-6 w-6 rounded-md"
                  onClick={() =>
                    actions.handleUpdateOverlay(overlay.id, { shape: "rect" })
                  }
                >
                  <Square className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Rectangle</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon-sm"
                  variant={overlay.shape === "ellipse" ? "default" : "ghost"}
                  aria-label="Ellipse shape"
                  aria-pressed={overlay.shape === "ellipse"}
                  className="h-6 w-6 rounded-md"
                  onClick={() =>
                    actions.handleUpdateOverlay(overlay.id, {
                      shape: "ellipse",
                    })
                  }
                >
                  <Circle className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Ellipse</TooltipContent>
            </Tooltip>
          </div>
          <Separator orientation="vertical" className="mx-0.5 h-5" />
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label="Whiteout fill color"
                    className="h-7 gap-1.5 px-2 text-xs"
                  >
                    <span
                      className="h-3.5 w-3.5 rounded-sm border border-black/20"
                      style={{ backgroundColor: overlay.fill_hex }}
                    />
                    <span>Fill</span>
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Whiteout fill color</TooltipContent>
            </Tooltip>
            <PopoverContent className="w-56 p-3">
              <ColorSwatchPicker
                title="Fill color"
                value={overlay.fill_hex}
                fallbackPickerHex="#ffffff"
                swatches={WHITEOUT_SWATCHES}
                onChange={(hex) =>
                  actions.handleUpdateOverlay(overlay.id, { fill_hex: hex })
                }
              />
            </PopoverContent>
          </Popover>
        </>
      ) : (
        <ImageInspectorControls
          overlay={overlay}
          onStartCrop={() => actions.handleStartCrop(overlay)}
          onUpdate={(patch) => actions.handleUpdateOverlay(overlay.id, patch)}
        />
      )}

      <Separator orientation="vertical" className="mx-0.5 h-5" />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Duplicate overlay"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => actions.handleDuplicateOverlay(overlay)}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Duplicate (⌘D)</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Delete overlay"
            className="h-7 w-7 text-destructive hover:bg-destructive/15 hover:text-destructive"
            onClick={() => actions.handleDeleteOverlay(overlay.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Delete (⌫)</TooltipContent>
      </Tooltip>
    </div>
  );
}
