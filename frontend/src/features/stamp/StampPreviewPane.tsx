import { Dices, Loader2, Stamp, Upload } from "lucide-react";
import { AlertBanner } from "@/components/ui/alert-banner";
import { Button } from "@/components/ui/button";
import type { StampTemplate } from "@/lib/stampRenderer";
import { cn } from "@/lib/utils";
import { formatFileSize } from "@/lib/validation";

interface StampPreviewPaneProps {
  previewPaper: "paper" | "transparent";
  placementTilt: number;
  template: StampTemplate;
  hasSource: boolean;
  sourceLabel: string;
  maxImageBytes: number;
  extracting: boolean;
  extractError: string | null;
  onCanvasMount: (el: HTMLCanvasElement | null) => void;
  onPreviewPaperChange: (mode: "paper" | "transparent") => void;
  onRerollGrain: () => void;
  onDropFile: (file: File) => void;
  onBrowseClick: () => void;
  onClearSource: () => void;
}

export function StampPreviewPane({
  previewPaper,
  placementTilt,
  template,
  hasSource,
  sourceLabel,
  maxImageBytes,
  extracting,
  extractError,
  onCanvasMount,
  onPreviewPaperChange,
  onRerollGrain,
  onDropFile,
  onBrowseClick,
  onClearSource,
}: StampPreviewPaneProps) {
  return (
    <div className="flex flex-col gap-3.5 p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-lg border border-border bg-secondary p-0.5 text-[11px]">
          <button
            type="button"
            onClick={() => onPreviewPaperChange("paper")}
            className={cn(
              "cursor-pointer rounded-md px-2.5 py-1 font-medium transition-colors",
              previewPaper === "paper"
                ? "bg-[#232428] text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Paper Preview
          </button>
          <button
            type="button"
            onClick={() => onPreviewPaperChange("transparent")}
            className={cn(
              "cursor-pointer rounded-md px-2.5 py-1 font-medium transition-colors",
              previewPaper === "transparent"
                ? "bg-[#232428] text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Transparent
          </button>
        </div>

        <button
          type="button"
          onClick={onRerollGrain}
          title="Re-roll rubber ink grain pattern"
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-secondary px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Dices className="h-3.5 w-3.5" />
          Re-roll grain
        </button>
      </div>

      {/* Live Canvas Surface */}
      <div
        className={cn(
          "relative flex aspect-square max-h-[370px] w-full items-center justify-center overflow-hidden rounded-xl border border-border p-4",
          previewPaper === "paper"
            ? "bg-[#f8f7f3]"
            : "bg-[length:16px_16px] bg-[linear-gradient(45deg,#1f2023_25%,transparent_25%),linear-gradient(-45deg,#1f2023_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#1f2023_75%),linear-gradient(-45deg,transparent_75%,#1f2023_75%)] bg-[position:0_0,0_8px,8px_-8px,-8px_0] bg-[#141516]",
        )}
      >
        <canvas
          ref={onCanvasMount}
          style={{ transform: `rotate(${placementTilt}deg)` }}
          className="max-h-full max-w-full object-contain transition-transform duration-150"
        />

        {extracting && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#08090a]/65 backdrop-blur-[1px]">
            <Loader2 className="h-5 w-5 animate-spin text-[#7170ff]" />
            <span className="text-xs font-medium text-[#f7f8f8]">
              Removing background &amp; capturing pixels...
            </span>
          </div>
        )}

        {!hasSource && template === "raw" && !extracting && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-6 text-center">
            <Stamp className="h-8 w-8 text-[#8a8f98]/60" />
            <p className="text-xs font-medium text-[#62666d]">
              Upload a logo or stamp photo below
            </p>
          </div>
        )}
      </div>

      {/* Upload / Replace Source Image Dropzone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const dropped = e.dataTransfer.files?.[0];
          if (dropped) onDropFile(dropped);
        }}
        className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-input bg-secondary/70 px-3.5 py-2.5"
      >
        <div className="min-w-0">
          <div className="truncate text-xs font-medium text-foreground">
            {sourceLabel || "No logo uploaded yet (optional for seals)"}
          </div>
          <div className="text-[11px] text-muted-foreground">
            PNG, JPG, WebP up to {formatFileSize(maxImageBytes)}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {hasSource && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground"
              onClick={onClearSource}
            >
              Clear
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 px-2.5 text-xs"
            onClick={onBrowseClick}
          >
            <Upload className="h-3 w-3" />
            {hasSource ? "Replace" : "Upload logo"}
          </Button>
        </div>
      </div>

      {extractError && <AlertBanner message={extractError} />}
    </div>
  );
}
