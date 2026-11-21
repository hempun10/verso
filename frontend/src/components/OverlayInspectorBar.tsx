import {
  Check,
  Circle,
  Copy,
  Crop,
  Image as ImageIcon,
  RotateCcw,
  RotateCw,
  Square,
  Stamp,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ImageOverlay, PageOverlay, WhiteoutOverlay } from "@/types";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

const WHITEOUT_SWATCHES = [
  { hex: "#ffffff", label: "Pure White" },
  { hex: "#fafafa", label: "Off-White" },
  { hex: "#fdfbf7", label: "Warm Paper" },
  { hex: "#f4f4f5", label: "Light Gray" },
  { hex: "#e4e4e7", label: "Muted Gray" },
  { hex: "#000000", label: "Blackout" },
];

interface OverlayInspectorBarProps {
  overlay: PageOverlay;
  isCropping: boolean;
  onStartCrop: () => void;
  onApplyCrop: () => void;
  onResetCrop: () => void;
  onCancelCrop: () => void;
  onUpdate: (patch: Partial<WhiteoutOverlay> | Partial<ImageOverlay>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function OverlayInspectorBar({
  overlay,
  isCropping,
  onStartCrop,
  onApplyCrop,
  onResetCrop,
  onCancelCrop,
  onUpdate,
  onDuplicate,
  onDelete,
}: OverlayInspectorBarProps) {
  if (overlay.kind === "image" && isCropping) {
    return (
      <div
        className="inspector-bar fixed top-[66px] left-1/2 z-30 flex w-max max-w-[calc(100vw-24px)] -translate-x-1/2 items-center gap-1.5 rounded-xl border border-input bg-popover px-2.5 py-1.5 shadow-[0_14px_40px_-10px_rgba(0,0,0,0.75)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <Badge variant="default" className="gap-1 px-2 py-0.5 text-[11px]">
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
          onClick={onResetCrop}
        >
          Reset
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label="Cancel crop"
          className="h-7 gap-1 px-2 text-xs"
          onClick={onCancelCrop}
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
          onClick={onApplyCrop}
        >
          <Check className="h-3.5 w-3.5" />
          Done
        </Button>
      </div>
    );
  }

  return (
    <div
      className="inspector-bar fixed top-[66px] left-1/2 z-30 flex w-max max-w-[calc(100vw-24px)] -translate-x-1/2 flex-wrap items-center gap-1.5 rounded-xl border border-input bg-popover px-2.5 py-1.5 shadow-[0_14px_40px_-10px_rgba(0,0,0,0.75)]"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {overlay.kind === "whiteout" ? (
        <>
          <Badge variant="secondary" className="gap-1 px-2 py-0.5 text-[11px]">
            <Square className="h-3 w-3" />
            Whiteout
          </Badge>

          <Separator orientation="vertical" className="mx-0.5 h-5" />

          {/* Shape toggle */}
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
                  onClick={() => onUpdate({ shape: "rect" })}
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
                  onClick={() => onUpdate({ shape: "ellipse" })}
                >
                  <Circle className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Ellipse</TooltipContent>
            </Tooltip>
          </div>

          <Separator orientation="vertical" className="mx-0.5 h-5" />

          {/* Fill color popover */}
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
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">
                  Fill color
                </span>
                <span className="font-mono text-[11px] text-muted-foreground uppercase">
                  {overlay.fill_hex}
                </span>
              </div>
              <div className="grid grid-cols-6 gap-1.5">
                {WHITEOUT_SWATCHES.map(({ hex, label }) => {
                  const isCurrent =
                    overlay.fill_hex.toLowerCase() === hex.toLowerCase();
                  const isDark = hex === "#000000";
                  return (
                    <button
                      key={hex}
                      type="button"
                      title={label}
                      onClick={() => onUpdate({ fill_hex: hex })}
                      className={cn(
                        "flex h-7 w-full cursor-pointer items-center justify-center rounded-md border transition-transform hover:scale-105",
                        isCurrent
                          ? "ring-2 ring-primary ring-offset-1"
                          : "border-black/20",
                      )}
                      style={{ backgroundColor: hex }}
                    >
                      {isCurrent && (
                        <Check
                          className={cn(
                            "h-3.5 w-3.5",
                            isDark ? "text-white" : "text-zinc-900",
                          )}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
              <Separator className="my-2.5" />
              <div className="flex items-center gap-2">
                <label
                  title="Pick custom fill"
                  className="relative h-7 w-7 shrink-0 cursor-pointer overflow-hidden rounded-md border border-input shadow-xs"
                  style={{ backgroundColor: overlay.fill_hex }}
                >
                  <input
                    type="color"
                    aria-label="Custom whiteout fill picker"
                    value={
                      HEX_RE.test(overlay.fill_hex)
                        ? overlay.fill_hex
                        : "#ffffff"
                    }
                    onChange={(e) => onUpdate({ fill_hex: e.target.value })}
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                </label>
                <Input
                  aria-label="Custom whiteout fill hex"
                  value={overlay.fill_hex}
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    if (HEX_RE.test(v)) onUpdate({ fill_hex: v });
                  }}
                  className="h-7 font-mono text-xs uppercase"
                />
              </div>
            </PopoverContent>
          </Popover>
        </>
      ) : (
        <>
          <Badge variant="secondary" className="gap-1 px-2 py-0.5 text-[11px]">
            <ImageIcon className="h-3 w-3" />
            Image
          </Badge>

          <Separator orientation="vertical" className="mx-0.5 h-5" />

          {/* Crop button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant={overlay.crop ? "secondary" : "outline"}
                aria-label="Crop image"
                className="h-7 gap-1 px-2 text-xs"
                onClick={onStartCrop}
              >
                <Crop className="h-3.5 w-3.5" />
                <span>Crop</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Crop image (C)</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="mx-0.5 h-5" />

          {/* Quick presets: Signature vs Watermark */}
          <div className="flex items-center gap-0.5 rounded-lg bg-accent p-0.5">
            <Button
              type="button"
              size="sm"
              variant={
                overlay.opacity >= 0.95 && Math.abs(overlay.angle_deg) < 1
                  ? "default"
                  : "ghost"
              }
              className="h-6 rounded-md px-2 text-[11px]"
              onClick={() => onUpdate({ opacity: 1, angle_deg: 0 })}
            >
              Signature
            </Button>
            <Button
              type="button"
              size="sm"
              variant={overlay.opacity <= 0.4 ? "default" : "ghost"}
              className="h-6 gap-1 rounded-md px-2 text-[11px]"
              onClick={() => onUpdate({ opacity: 0.25, angle_deg: -30 })}
            >
              <Stamp className="h-3 w-3" />
              Watermark
            </Button>
          </div>

          <Separator orientation="vertical" className="mx-0.5 h-5" />

          {/* shadcn Slider for Opacity */}
          <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
            <span>Opacity</span>
            <Slider
              aria-label="Image opacity"
              min={10}
              max={100}
              step={5}
              value={[Math.round(overlay.opacity * 100)]}
              onValueChange={([v]) => {
                if (v !== undefined) onUpdate({ opacity: v / 100 });
              }}
              className="w-20"
            />
            <span className="w-8 text-right font-medium text-foreground tabular-nums">
              {Math.round(overlay.opacity * 100)}%
            </span>
          </div>

          <Separator orientation="vertical" className="mx-0.5 h-5" />

          {/* Rotation stepper */}
          <div className="flex items-center rounded-md border border-input bg-background shadow-xs">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Rotate left 15 degrees"
                  className="h-7 w-6 rounded-r-none border-r border-input/70"
                  onClick={() =>
                    onUpdate({
                      angle_deg: Math.max(-180, overlay.angle_deg - 15),
                    })
                  }
                >
                  <RotateCcw className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Rotate -15° (⇧R)</TooltipContent>
            </Tooltip>
            <Input
              type="number"
              aria-label="Rotation angle (degrees)"
              min={-180}
              max={180}
              step={5}
              value={Math.round(overlay.angle_deg)}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (!Number.isNaN(v)) {
                  onUpdate({ angle_deg: Math.max(-180, Math.min(180, v)) });
                }
              }}
              className="h-7 w-12 border-0 px-1 text-center text-xs shadow-none focus-visible:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Rotate right 15 degrees"
                  className="h-7 w-6 rounded-l-none border-l border-input/70"
                  onClick={() =>
                    onUpdate({
                      angle_deg: Math.min(180, overlay.angle_deg + 15),
                    })
                  }
                >
                  <RotateCw className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Rotate +15° (R)</TooltipContent>
            </Tooltip>
          </div>
        </>
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
            onClick={onDuplicate}
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
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Delete (⌫)</TooltipContent>
      </Tooltip>
    </div>
  );
}
