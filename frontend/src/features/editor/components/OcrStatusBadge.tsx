import { useEffect, useState } from "react";
import { Cloud, Cpu, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
  clearLocalOcrCache,
  getOcrStatus,
  setOcrEnginePreference,
  subscribeOcrStatus,
  type OcrStatusSnapshot,
} from "@/lib/ocr/ocrClient";
import { cn } from "@/lib/utils";

export function OcrStatusBadge() {
  const [status, setStatus] = useState<OcrStatusSnapshot>(() => getOcrStatus());
  const [clearing, setClearing] = useState(false);

  useEffect(() => subscribeOcrStatus(setStatus), []);

  const isLocalActive = status.supported && status.preference === "local";
  const isBusy =
    isLocalActive &&
    (status.stage === "downloading" ||
      status.stage === "initializing" ||
      status.stage === "running");

  const label = !isLocalActive
    ? "Cloud OCR"
    : status.stage === "downloading"
      ? `OCR ${status.progress}%`
      : status.stage === "initializing"
        ? "OCR loading"
        : "Local OCR";

  const handleClearCache = async () => {
    setClearing(true);
    try {
      await clearLocalOcrCache();
    } finally {
      setClearing(false);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-label font-medium transition-colors hover:bg-accent",
            isLocalActive ? "text-foreground/90" : "text-muted-foreground",
          )}
          title="OCR engine settings"
        >
          {isBusy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />
          ) : isLocalActive ? (
            <Cpu className="h-3.5 w-3.5 text-brand" />
          ) : (
            <Cloud className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <span className="tabular-nums">{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="center"
        side="top"
        sideOffset={10}
        className="w-64 border-input bg-popover p-3 text-foreground"
      >
        <div className="space-y-1">
          <div className="text-xs font-semibold text-foreground">
            Scanned Text OCR Engine
          </div>
          <p className="text-label leading-relaxed text-muted-foreground">
            Run PP-OCRv4 locally in your browser (cached offline after first 16
            MB download) or use Cloud OCR.
          </p>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-1.5">
          <Button
            type="button"
            size="sm"
            variant={isLocalActive ? "default" : "outline"}
            disabled={!status.supported}
            className="h-7.5 gap-1.5 text-xs"
            onClick={() => setOcrEnginePreference("local")}
          >
            <Cpu className="h-3.5 w-3.5" />
            Local
          </Button>
          <Button
            type="button"
            size="sm"
            variant={!isLocalActive ? "default" : "outline"}
            className="h-7.5 gap-1.5 text-xs"
            onClick={() => setOcrEnginePreference("cloud")}
          >
            <Cloud className="h-3.5 w-3.5" />
            Cloud
          </Button>
        </div>

        {!status.supported && (
          <p className="mt-2 text-label text-muted-foreground">
            Local OCR requires a desktop/4 GB+ device with WebAssembly support.
          </p>
        )}

        {status.cached && (
          <>
            <Separator className="my-2.5 bg-border" />
            <div className="flex items-center justify-between gap-2">
              <span className="text-label text-success">
                Models cached offline
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={clearing}
                onClick={() => void handleClearCache()}
                className="h-6 gap-1 px-2 text-label text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
                {clearing ? "Clearing..." : "Clear"}
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
