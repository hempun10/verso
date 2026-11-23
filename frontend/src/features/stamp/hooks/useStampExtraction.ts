import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { extractStampMask, fetchAssetBlob } from "@/api";
import { queryKeys } from "@/lib/queryClient";
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
  const [extractError, setExtractError] = useState<string | null>(null);

  const sourceQuery = useQuery({
    queryKey: queryKeys.stampSource(initialImageUrl ?? ""),
    queryFn: ({ signal }) => fetchAssetBlob(initialImageUrl!, signal),
    enabled: Boolean(open && !initialFile && initialImageUrl),
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (sourceQuery.data) {
      onLoadedInitialBlob(sourceQuery.data);
    }
  }, [onLoadedInitialBlob, sourceQuery.data]);

  useEffect(() => {
    if (sourceQuery.error) {
      setExtractError(
        sourceQuery.error instanceof Error
          ? sourceQuery.error.message
          : "Could not load saved image.",
      );
    }
  }, [sourceQuery.error]);

  const extractMut = useMutation({
    mutationFn: (vars: {
      blob: Blob;
      mode: StampExtractMode;
      sensitivity: number;
      removeInnerWhite: boolean;
    }) =>
      extractStampMask(vars.blob, {
        mode: vars.mode,
        sensitivity: vars.sensitivity,
        removeInnerWhite: vars.removeInnerWhite,
      }),
  });
  const { mutateAsync } = extractMut;

  useEffect(() => {
    if (!open || !sourceBlob) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setExtractError(null);
      let objectUrl: string | null = null;
      try {
        const maskBlob = await mutateAsync({
          blob: sourceBlob,
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
      }
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, sourceBlob, extractMode, sensitivity, removeInnerWhite, mutateAsync]);

  return {
    maskImg,
    setMaskImg,
    extracting: sourceQuery.isFetching || extractMut.isPending,
    extractError,
    setExtractError,
  };
}
