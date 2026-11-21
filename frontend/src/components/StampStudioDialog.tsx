import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Loader2, Stamp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StampControlsPane } from "@/features/stamp/StampControlsPane";
import { StampPreviewPane } from "@/features/stamp/StampPreviewPane";
import { useStampExtraction } from "@/features/stamp/useStampExtraction";
import { stripFileExtension, triggerDownload } from "@/lib/format";
import {
  exportStampPng,
  renderStampToCanvas,
  STAMP_INK_PRESETS,
  type StampConfig,
  type StampExtractMode,
} from "@/lib/stampRenderer";
import {
  DEFAULT_UPLOAD_LIMITS,
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
    return initialImageUrl && initialName
      ? `${initialName} Stamp`
      : "Official Stamp";
  });
  const [saving, setSaving] = useState<boolean>(false);

  const handleLoadedInitialBlob = useCallback((blob: Blob) => {
    setSourceBlob(blob);
  }, []);

  const { maskImg, setMaskImg, extracting, extractError, setExtractError } =
    useStampExtraction({
      open,
      initialFile,
      initialImageUrl,
      sourceBlob,
      extractMode,
      sensitivity,
      removeInnerWhite,
      onLoadedInitialBlob: handleLoadedInitialBlob,
    });

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
  ) => setConfig((prev) => ({ ...prev, [key]: value }));

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
          <StampPreviewPane
            previewPaper={previewPaper}
            placementTilt={placementTilt}
            template={config.template}
            hasSource={Boolean(sourceBlob)}
            sourceLabel={sourceLabel}
            maxImageBytes={limits.max_image_bytes}
            extracting={extracting}
            extractError={extractError}
            onCanvasMount={setCanvasEl}
            onPreviewPaperChange={setPreviewPaper}
            onRerollGrain={() =>
              updateConfig("seed", Math.floor(Math.random() * 99999) + 1)
            }
            onDropFile={handleChooseFile}
            onBrowseClick={() => fileInputRef.current?.click()}
            onClearSource={() => {
              setSourceBlob(null);
              setSourceLabel("");
              setMaskImg(null);
            }}
          />

          <StampControlsPane
            hasSource={Boolean(sourceBlob)}
            extractMode={extractMode}
            sensitivity={sensitivity}
            removeInnerWhite={removeInnerWhite}
            config={config}
            placementTilt={placementTilt}
            saveToLibrary={saveToLibrary}
            stampName={stampName}
            onExtractModeChange={setExtractMode}
            onSensitivityChange={setSensitivity}
            onRemoveInnerWhiteChange={setRemoveInnerWhite}
            onUpdateConfig={updateConfig}
            onPlacementTiltChange={setPlacementTilt}
            onSaveToLibraryChange={setSaveToLibrary}
            onStampNameChange={setStampName}
          />
        </div>

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
