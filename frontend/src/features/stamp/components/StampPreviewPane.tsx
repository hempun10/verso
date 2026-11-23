import { useState } from "react";
import { Dices, Loader2, Stamp, Upload } from "lucide-react";
import { AlertBanner } from "@/components/ui/alert-banner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatFileSize } from "@/lib/validation";
import { useStampStudio } from "../context/StampStudioContext";

export function StampPreviewPane() {
  const {
    limits,
    hasSource,
    sourceLabel,
    extracting,
    extractError,
    config,
    placementTilt,
    onCanvasMount,
    rerollGrain,
    chooseFile,
    openFilePicker,
    clearSource,
  } = useStampStudio();

  // Colocated preview backdrop state owned strictly by StampPreviewPane.
  const [previewPaper, setPreviewPaper] = useState<"paper" | "transparent">(
    "paper",
  );

  return (
    <div className="flex flex-col gap-3.5 p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-lg border border-border bg-secondary p-0.5 text-label">
          <button
            type="button"
            onClick={() => setPreviewPaper("paper")}
            className={cn(
              "cursor-pointer rounded-md px-2.5 py-1 font-medium transition-colors",
              previewPaper === "paper"
                ? "bg-surface-active text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Paper Preview
          </button>
          <button
            type="button"
            onClick={() => setPreviewPaper("transparent")}
            className={cn(
              "cursor-pointer rounded-md px-2.5 py-1 font-medium transition-colors",
              previewPaper === "transparent"
                ? "bg-surface-active text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Transparent
          </button>
        </div>

        <button
          type="button"
          onClick={rerollGrain}
          title="Re-roll rubber ink grain pattern"
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-secondary px-2.5 py-1 text-label font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Dices className="h-3.5 w-3.5" />
          Re-roll grain
        </button>
      </div>

      <div
        className={cn(
          "relative flex aspect-square max-h-92.5 w-full items-center justify-center overflow-hidden rounded-xl border border-border p-4",
          previewPaper === "paper"
            ? "bg-paper"
            : "bg-checkerboard",
        )}
      >
        <canvas
          ref={onCanvasMount}
          style={{ transform: `rotate(${placementTilt}deg)` }}
          className="max-h-full max-w-full object-contain transition-transform duration-150"
        />

        {extracting && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/65 backdrop-blur-xs">
            <Loader2 className="h-5 w-5 animate-spin text-brand" />
            <span className="text-xs font-medium text-foreground">
              Removing background &amp; capturing pixels...
            </span>
          </div>
        )}

        {!hasSource && config.template === "raw" && !extracting && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-6 text-center">
            <Stamp className="h-8 w-8 text-muted-foreground/60" />
            <p className="text-xs font-medium text-dim-foreground">
              Upload a logo or stamp photo below
            </p>
          </div>
        )}
      </div>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const dropped = e.dataTransfer.files?.[0];
          if (dropped) chooseFile(dropped);
        }}
        className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-input bg-secondary/70 px-3.5 py-2.5"
      >
        <div className="min-w-0">
          <div className="truncate text-xs font-medium text-foreground">
            {sourceLabel || "No logo uploaded yet (optional for seals)"}
          </div>
          <div className="text-label text-muted-foreground">
            PNG, JPG, WebP up to {formatFileSize(limits.max_image_bytes)}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {hasSource && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground"
              onClick={clearSource}
            >
              Clear
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 px-2.5 text-xs"
            onClick={openFilePicker}
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
