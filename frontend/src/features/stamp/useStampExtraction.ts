import { useEffect, useState } from "react";
import { extractStampMask } from "@/api";
import type { StampExtractMode } from "@/lib/stampRenderer";

interface UseStampExtractionArgs {
  open: boolean;
  initialFile: File | null;
  initialImageUrl: string | null;
  sourceBlob: Blob | null;
  extractMode: StampExtractMode;
  sensitivity: number;
  removeInnerWhite: boolean;
  onLoadedInitialBlob: (blob: Blob) => void;
}

export function useStampExtraction({
  open,
  initialFile,
  initialImageUrl,
  sourceBlob,
  extractMode,
  sensitivity,
  removeInnerWhite,
  onLoadedInitialBlob,
}: UseStampExtractionArgs) {
  const [maskImg, setMaskImg] = useState<HTMLImageElement | null>(null);
  const [extracting, setExtracting] = useState<boolean>(() =>
    Boolean(initialImageUrl && !initialFile),
  );
  const [extractError, setExtractError] = useState<string | null>(null);

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
      .then((blob) => onLoadedInitialBlob(blob))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setExtractError(
          err instanceof Error ? err.message : "Could not load image.",
        );
        setExtracting(false);
      });
    return () => controller.abort();
  }, [open, initialFile, initialImageUrl, onLoadedInitialBlob]);

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
        if (!cancelled) setMaskImg(img);
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

  return {
    maskImg,
    setMaskImg,
    extracting,
    extractError,
    setExtractError,
  };
}
