import {
  Crop,
  Image as ImageIcon,
  RotateCcw,
  RotateCw,
  Stamp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ImageOverlay } from "@/types";

interface ImageInspectorControlsProps {
  overlay: ImageOverlay;
  onStartCrop: () => void;
  onUpdate: (patch: Partial<ImageOverlay>) => void;
}

export function ImageInspectorControls({
  overlay,
  onStartCrop,
  onUpdate,
}: ImageInspectorControlsProps) {
  return (
    <>
      <Badge variant="secondary" className="gap-1 px-2 py-0.5 text-[11px]">
        <ImageIcon className="h-3 w-3" />
        Image
      </Badge>

      <Separator orientation="vertical" className="mx-0.5 h-5" />

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
                onUpdate({ angle_deg: Math.max(-180, overlay.angle_deg - 15) })
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
                onUpdate({ angle_deg: Math.min(180, overlay.angle_deg + 15) })
              }
            >
              <RotateCw className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Rotate +15° (R)</TooltipContent>
        </Tooltip>
      </div>
    </>
  );
}
