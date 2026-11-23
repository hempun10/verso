import { Download, Loader2, Stamp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StampControlsPane } from "@/features/stamp/components/StampControlsPane";
import { StampPreviewPane } from "@/features/stamp/components/StampPreviewPane";
import {
  StampStudioProvider,
  useStampStudio,
} from "@/features/stamp/context/StampStudioContext";
import { DEFAULT_UPLOAD_LIMITS } from "@/lib/validation";
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

function StampStudioFooter({ onClose }: { onClose: () => void }) {
  const {
    canExport,
    saving,
    extracting,
    saveToLibrary,
    downloadPng,
    placeStamp,
  } = useStampStudio();

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-card/80 px-6 py-3.5">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={!canExport}
        onClick={downloadPng}
        className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <Download className="h-3.5 w-3.5" />
        Download PNG
      </Button>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="button"
          disabled={saving || extracting || !canExport}
          className="btn-primary gap-1.5"
          onClick={() => void placeStamp()}
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
  );
}

export function StampStudioDialog({
  open,
  onOpenChange,
  limits = DEFAULT_UPLOAD_LIMITS,
  initialFile = null,
  initialImageUrl = null,
  initialName = "",
  onSaveAndPlaceStamp,
}: StampStudioDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-4xl flex-col overflow-hidden p-0">
        <div className="border-b border-border px-6 py-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Stamp className="h-4 w-4 text-brand" />
              Government Stamp Studio
            </DialogTitle>
            <DialogDescription>
              Upload a logo or photo — we remove the background, capture the
              pixels, and turn it into an official rubber stamp saved to your
              library.
            </DialogDescription>
          </DialogHeader>
        </div>

        <StampStudioProvider
          open={open}
          limits={limits}
          initialFile={initialFile}
          initialImageUrl={initialImageUrl}
          initialName={initialName}
          onSaveAndPlaceStamp={onSaveAndPlaceStamp}
          onClose={() => onOpenChange(false)}
        >
          <div className="grid min-h-0 flex-1 grid-cols-1 divide-y divide-border overflow-y-auto md:grid-cols-[1.05fr_1fr] md:divide-x md:divide-y-0">
            <StampPreviewPane />
            <StampControlsPane />
          </div>
          <StampStudioFooter onClose={() => onOpenChange(false)} />
        </StampStudioProvider>
      </DialogContent>
    </Dialog>
  );
}
