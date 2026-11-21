import { useEffect, useRef, useState } from "react";
import { Check, Dices, Download, Loader2, Stamp, Upload } from "lucide-react";
import { extractStampMask } from "@/api";
import { AlertBanner } from "@/components/ui/alert-banner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { stripFileExtension, triggerDownload } from "@/lib/format";
import {
  exportStampPng,
  renderStampToCanvas,
  STAMP_INK_PRESETS,
  type StampBorderStyle,
  type StampConfig,
  type StampExtractMode,
  type StampTemplate,
} from "@/lib/stampRenderer";
import { cn } from "@/lib/utils";
import {
  DEFAULT_UPLOAD_LIMITS,
  formatFileSize,
  validateImageFileClient,
} from "@/lib/validation";
import type { UploadLimits } from "@/types";

interface StampStudioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  limits?: UploadLimits;
  initialFile?: File | null;
  initialImageUrl?: string | null;
  initialName?: string;
  onSaveAndPlaceStamp: (
    dataUrl: string,
    width: number,
    height: number,
    saveToLibrary: boolean,
    name: string,
    angleDeg: number,
  ) => Promise<void>;
}

const EXTRACT_MODES: {
  id: StampExtractMode;
  label: string;
  hint: string;
}[] = [
  { id: "ink", label: "Logo / Scan", hint: "Clean logos & paper scans" },
  { id: "engraved", label: "Engraved", hint: "Full-color emblems & crests" },
  { id: "cutout", label: "Photo Cutout", hint: "Isolate subject from photo" },
];

const TEMPLATES: { id: StampTemplate; label: string }[] = [
  { id: "circle", label: "Circle Seal" },
  { id: "oval", label: "Oval Seal" },
  { id: "rect", label: "Box Stamp" },
  { id: "raw", label: "Logo Only" },
];

const BORDER_STYLES: { id: StampBorderStyle; label: string }[] = [
  { id: "classic", label: "Classic" },
  { id: "dotted", label: "Dotted" },
  { id: "notary", label: "Notary" },
];

const DEFAULT_CONFIG: StampConfig = {
  template: "circle",
  borderStyle: "classic",
  inkColor: STAMP_INK_PRESETS[0].hex,
  topText: "OFFICE OF THE REGISTRAR",
  bottomText: "OFFICIAL SEAL",
  showStars: true,
  showDate: false,
  logoScale: 0.82,
  distress: 32,
  seed: 42,
};

export function StampStudioDialog({
  open,
  onOpenChange,
  limits = DEFAULT_UPLOAD_LIMITS,
  initialFile = null,
  initialImageUrl = null,
  initialName = "",
  onSaveAndPlaceStamp,
}: StampStudioDialogProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null);

  const [sourceBlob, setSourceBlob] = useState<Blob | null>(() => initialFile);
  const [sourceLabel, setSourceLabel] = useState<string>(() =>
    initialFile
      ? initialFile.name
      : initialImageUrl
        ? initialName || "Saved image"
        : "",
  );
  const [extractMode, setExtractMode] = useState<StampExtractMode>("ink");
  const [sensitivity, setSensitivity] = useState<number>(52);
  const [removeInnerWhite, setRemoveInnerWhite] = useState<boolean>(true);

  const [maskImg, setMaskImg] = useState<HTMLImageElement | null>(null);
  const [extracting, setExtracting] = useState<boolean>(() =>
    Boolean(initialImageUrl && !initialFile),
  );
  const [extractError, setExtractError] = useState<string | null>(null);

  const [config, setConfig] = useState<StampConfig>(DEFAULT_CONFIG);
  const [placementTilt, setPlacementTilt] = useState<number>(-5);
  const [previewPaper, setPreviewPaper] = useState<"paper" | "transparent">(
    "paper",
  );
  const [saveToLibrary, setSaveToLibrary] = useState<boolean>(true);
  const [stampName, setStampName] = useState<string>(() => {
    if (initialFile) {
      const base = stripFileExtension(initialFile.name, "");
      return base ? `${base} Stamp` : "Official Stamp";
    }
    if (initialImageUrl && initialName) {
      return `${initialName} Stamp`;
    }
    return "Official Stamp";
  });
  const [saving, setSaving] = useState<boolean>(false);

  // Fetch saved library asset bytes only when opened from an existing library image URL.
  useEffect(() => {
    if (!open || initialFile || !initialImageUrl) return;
    const controller = new AbortController();
    setExtracting(true);
    setExtractError(null);
    fetch(initialImageUrl, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error("Could not load saved image.");
        return res.blob();
      })
      .then((blob) => setSourceBlob(blob))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setExtractError(
          err instanceof Error ? err.message : "Could not load image.",
        );
        setExtracting(false);
      });
    return () => controller.abort();
  }, [open, initialFile, initialImageUrl]);

  // Run backend OpenCV pixel extraction whenever source image or extraction knobs change (debounced).
  useEffect(() => {
    if (!open || !sourceBlob) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setExtracting(true);
      setExtractError(null);
      let objectUrl: string | null = null;
      try {
        const maskBlob = await extractStampMask(sourceBlob, {
          mode: extractMode,
          sensitivity,
          removeInnerWhite,
        });
        if (cancelled) return;
        objectUrl = URL.createObjectURL(maskBlob);
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("Could not decode stamp mask."));
          img.src = objectUrl!;
        });
        if (!cancelled) {
          setMaskImg(img);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setExtractError(
            err instanceof Error
              ? err.message
              : "Failed to extract stamp pixels.",
          );
        }
      } finally {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        if (!cancelled) setExtracting(false);
      }
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, sourceBlob, extractMode, sensitivity, removeInnerWhite]);

  // Live 60fps Canvas preview whenever the portal-mounted canvas, mask, or config updates.
  useEffect(() => {
    if (!open || !canvasEl) return;
    renderStampToCanvas(canvasEl, maskImg, config);
  }, [open, canvasEl, maskImg, config]);

  const handleChooseFile = (file: File) => {
    setExtractError(null);
    const err = validateImageFileClient(file, limits);
    if (err) {
      setExtractError(err);
      return;
    }
    setSourceBlob(file);
    setSourceLabel(file.name);
    const base = stripFileExtension(file.name, "");
    if (base) setStampName(`${base} Stamp`);
  };

  const canExport = Boolean(
    maskImg ||
      (config.template !== "raw" &&
        (config.topText.trim() || config.bottomText.trim() || config.showDate)),
  );

  const handleDownloadPng = () => {
    const exported = exportStampPng(maskImg, config);
    if (!exported) return;
    const slug = (stampName.trim() || "official-stamp")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-");
    triggerDownload(exported.dataUrl, `${slug}.png`);
  };

  const handlePlace = async () => {
    const exported = exportStampPng(maskImg, config);
    if (!exported) return;
    setSaving(true);
    setExtractError(null);
    try {
      await onSaveAndPlaceStamp(
        exported.dataUrl,
        exported.width,
        exported.height,
        saveToLibrary,
        stampName.trim() || "Official Stamp",
        placementTilt,
      );
      onOpenChange(false);
    } catch (err: unknown) {
      setExtractError(
        err instanceof Error ? err.message : "Failed to save stamp.",
      );
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = <K extends keyof StampConfig>(
    key: K,
    value: StampConfig[K],
  ) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-4xl flex-col overflow-hidden p-0">
        <div className="border-b border-border px-6 py-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Stamp className="h-4 w-4 text-[#7170ff]" />
              Government Stamp Studio
            </DialogTitle>
            <DialogDescription>
              Upload a logo or photo — we remove the background, capture the
              pixels, and turn it into an official rubber stamp saved to your
              library.
            </DialogDescription>
          </DialogHeader>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={limits.allowed_image_types.join(",")}
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleChooseFile(file);
            e.target.value = "";
          }}
        />

        <div className="grid min-h-0 flex-1 grid-cols-1 divide-y divide-border overflow-y-auto md:grid-cols-[1.05fr_1fr] md:divide-x md:divide-y-0">
          {/* Left: Live Stamp Preview + Logo Upload */}
          <div className="flex flex-col gap-3.5 p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 rounded-lg border border-border bg-secondary p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setPreviewPaper("paper")}
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
                  onClick={() => setPreviewPaper("transparent")}
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
                onClick={() =>
                  updateConfig("seed", Math.floor(Math.random() * 99999) + 1)
                }
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
                ref={setCanvasEl}
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

              {!sourceBlob && config.template === "raw" && !extracting && (
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
                if (dropped) handleChooseFile(dropped);
              }}
              className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-input bg-secondary/70 px-3.5 py-2.5"
            >
              <div className="min-w-0">
                <div className="truncate text-xs font-medium text-foreground">
                  {sourceLabel || "No logo uploaded yet (optional for seals)"}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  PNG, JPG, WebP up to {formatFileSize(limits.max_image_bytes)}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {sourceBlob && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-muted-foreground"
                    onClick={() => {
                      setSourceBlob(null);
                      setSourceLabel("");
                      setMaskImg(null);
                    }}
                  >
                    Clear
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 px-2.5 text-xs"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-3 w-3" />
                  {sourceBlob ? "Replace" : "Upload logo"}
                </Button>
              </div>
            </div>

            {extractError && <AlertBanner message={extractError} />}
          </div>

          {/* Right: Extraction & Seal Controls */}
          <div className="flex flex-col gap-4 overflow-y-auto p-5">
            {/* 1. Background Removal & Pixel Capture */}
            {sourceBlob && (
              <div className="space-y-2.5 rounded-xl border border-border bg-secondary/45 p-3.5">
                <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  1. Pixel Capture &amp; Background Removal
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {EXTRACT_MODES.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      title={m.hint}
                      onClick={() => setExtractMode(m.id)}
                      className={cn(
                        "cursor-pointer rounded-lg border px-2 py-1.5 text-center text-[11px] font-medium transition-colors",
                        extractMode === m.id
                          ? "border-[#7170ff]/70 bg-[#7170ff]/18 text-foreground"
                          : "border-border bg-card text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">
                      Ink sensitivity
                    </span>
                    <span className="font-mono text-foreground tabular-nums">
                      {sensitivity}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={92}
                    value={sensitivity}
                    onChange={(e) => setSensitivity(Number(e.target.value))}
                    className="h-1.5 w-full cursor-pointer accent-[#7170ff]"
                  />
                </div>

                <label className="flex cursor-pointer items-center gap-2 text-xs text-foreground/90">
                  <Checkbox
                    checked={removeInnerWhite}
                    onCheckedChange={(v) => setRemoveInnerWhite(Boolean(v))}
                  />
                  <span>Make interior white areas transparent</span>
                </label>
              </div>
            )}

            {/* 2. Government Seal Layout */}
            <div className="space-y-2.5">
              <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                Seal Style &amp; Ink
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => updateConfig("template", t.id)}
                    className={cn(
                      "cursor-pointer rounded-lg border px-2 py-1.5 text-center text-[11px] font-medium transition-colors",
                      config.template === t.id
                        ? "border-[#7170ff]/70 bg-[#7170ff]/18 text-foreground"
                        : "border-border bg-secondary text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {config.template !== "raw" && (
                <div className="grid grid-cols-3 gap-1.5">
                  {BORDER_STYLES.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => updateConfig("borderStyle", b.id)}
                      className={cn(
                        "cursor-pointer rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
                        config.borderStyle === b.id
                          ? "border-input bg-[#232428] text-foreground"
                          : "border-border/60 bg-secondary/60 text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {b.label} Ring
                    </button>
                  ))}
                </div>
              )}

              {/* Ink Color Swatches */}
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                {STAMP_INK_PRESETS.map((c) => {
                  const active =
                    config.inkColor.toLowerCase() === c.hex.toLowerCase();
                  return (
                    <button
                      key={c.hex}
                      type="button"
                      title={c.label}
                      onClick={() => updateConfig("inkColor", c.hex)}
                      className={cn(
                        "flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-2 transition-transform hover:scale-105",
                        active
                          ? "border-white ring-2 ring-[#7170ff]/60"
                          : "border-border",
                      )}
                      style={{ backgroundColor: c.hex }}
                    >
                      {active && <Check className="h-3.5 w-3.5 text-white" />}
                    </button>
                  );
                })}
                <label
                  title="Custom ink color"
                  className="flex h-7 cursor-pointer items-center gap-1.5 rounded-full border border-border bg-secondary px-2.5 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  <input
                    type="color"
                    value={config.inkColor}
                    onChange={(e) => updateConfig("inkColor", e.target.value)}
                    className="h-4 w-4 cursor-pointer border-0 bg-transparent p-0"
                  />
                  <span>Custom</span>
                </label>
              </div>
            </div>

            {/* 3. Seal Text (for Circle / Oval / Box) */}
            {config.template !== "raw" && (
              <div className="space-y-2">
                <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  Seal Text
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Input
                    value={config.topText}
                    onChange={(e) => updateConfig("topText", e.target.value)}
                    placeholder="Top arc / Header text"
                    className="h-8 text-xs"
                  />
                  <Input
                    value={config.bottomText}
                    onChange={(e) => updateConfig("bottomText", e.target.value)}
                    placeholder="Bottom arc / Subtitle"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-4 pt-0.5">
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-foreground/90">
                    <Checkbox
                      checked={config.showStars}
                      onCheckedChange={(v) =>
                        updateConfig("showStars", Boolean(v))
                      }
                    />
                    <span>Divider stars (★)</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-foreground/90">
                    <Checkbox
                      checked={config.showDate}
                      onCheckedChange={(v) =>
                        updateConfig("showDate", Boolean(v))
                      }
                    />
                    <span>Include today&apos;s date</span>
                  </label>
                </div>
              </div>
            )}

            {/* 4. Realism & Placement Fine-Tune */}
            <div className="space-y-2.5">
              <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                Ink Realism &amp; Size
              </div>
              {sourceBlob && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Logo scale</span>
                    <span className="font-mono text-foreground tabular-nums">
                      {Math.round(config.logoScale * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={40}
                    max={120}
                    value={Math.round(config.logoScale * 100)}
                    onChange={(e) =>
                      updateConfig("logoScale", Number(e.target.value) / 100)
                    }
                    className="h-1.5 w-full cursor-pointer accent-[#7170ff]"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Ink wear</span>
                    <span className="font-mono text-foreground tabular-nums">
                      {config.distress}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={85}
                    value={config.distress}
                    onChange={(e) =>
                      updateConfig("distress", Number(e.target.value))
                    }
                    className="h-1.5 w-full cursor-pointer accent-[#7170ff]"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Tilt angle</span>
                    <span className="font-mono text-foreground tabular-nums">
                      {placementTilt}°
                    </span>
                  </div>
                  <input
                    type="range"
                    min={-20}
                    max={20}
                    value={placementTilt}
                    onChange={(e) => setPlacementTilt(Number(e.target.value))}
                    className="h-1.5 w-full cursor-pointer accent-[#7170ff]"
                  />
                </div>
              </div>
            </div>

            {/* 5. Library Save Options */}
            <div className="space-y-2 rounded-xl border border-border bg-secondary/45 p-3">
              <div className="flex items-center justify-between gap-2">
                <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-foreground">
                  <Checkbox
                    checked={saveToLibrary}
                    onCheckedChange={(v) => setSaveToLibrary(Boolean(v))}
                  />
                  <span>Save stamp to library</span>
                </label>
              </div>
              {saveToLibrary && (
                <Input
                  value={stampName}
                  onChange={(e) => setStampName(e.target.value)}
                  placeholder="Stamp name (e.g. Registrar Official Seal)"
                  className="h-8 text-xs"
                />
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-card/80 px-6 py-3.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!canExport}
            onClick={handleDownloadPng}
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <Download className="h-3.5 w-3.5" />
            Download PNG
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={saving || extracting || !canExport}
              className="btn-primary gap-1.5"
              onClick={() => void handlePlace()}
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Stamp className="h-3.5 w-3.5" />
              )}
              {saving
                ? "Saving stamp..."
                : saveToLibrary
                  ? "Save & Place Stamp"
                  : "Place Stamp"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
