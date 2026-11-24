import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchPageBlocks, fetchPageImageBlob, fetchPagePreview } from "@/api";
import {
  getOcrStatus,
  runBrowserOcr,
  subscribeOcrStatus,
  type OcrStatusSnapshot,
} from "@/lib/ocr/ocrClient";
import { queryKeys } from "@/lib/queryClient";
import type { DocumentSummary, TextEdit } from "@/types";
import type { PagePreview } from "../types";

interface UsePageLoaderArgs {
  doc: DocumentSummary | null;
  pageIndex: number;
  activeShareToken: string | null;
  pageEdits: TextEdit[];
  onClearSelection: () => void;
  onBusy: (msg: string | null) => void;
  onError: (msg: string | null) => void;
}

export function usePageLoader({
  doc,
  pageIndex,
  activeShareToken,
  pageEdits,
  onClearSelection,
  onBusy,
  onError,
}: UsePageLoaderArgs) {
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState<PagePreview | null>(null);
  const [ocrStatus, setOcrStatus] = useState<OcrStatusSnapshot>(() =>
    getOcrStatus(),
  );

  useEffect(() => subscribeOcrStatus(setOcrStatus), []);

  const docId = doc?.doc_id ?? "";
  const pageInfo = doc?.pages[pageIndex] ?? null;
  const currentPageKey = doc ? `${docId}:${pageIndex}` : "";
  const editsKey = useMemo(() => JSON.stringify(pageEdits), [pageEdits]);

  const useLocalOcr = Boolean(
    pageInfo?.kind === "scanned" &&
      ocrStatus.supported &&
      ocrStatus.preference === "local",
  );
  const ocrMode: "native" | "local" | "cloud" =
    pageInfo?.kind === "scanned" ? (useLocalOcr ? "local" : "cloud") : "native";

  const blocksQuery = useQuery({
    queryKey: queryKeys.pageBlocks(docId, pageIndex, activeShareToken, ocrMode),
    queryFn: async ({ signal }) => {
      if (useLocalOcr && pageInfo) {
        try {
          const imageBlob = await queryClient.fetchQuery({
            queryKey: queryKeys.pageImage(
              docId,
              pageIndex,
              200,
              activeShareToken,
            ),
            queryFn: () =>
              fetchPageImageBlob(
                docId,
                pageIndex,
                200,
                activeShareToken,
                signal,
              ),
            staleTime: 5 * 60_000,
          });
          return await runBrowserOcr(imageBlob, pageInfo);
        } catch {
          // Graceful fallback to server RapidOCR if local WASM/models fail.
          return fetchPageBlocks(docId, pageIndex, activeShareToken);
        }
      }
      return fetchPageBlocks(docId, pageIndex, activeShareToken);
    },
    enabled: Boolean(doc && pageInfo),
    staleTime: 5 * 60_000,
  });

  const previewQuery = useQuery({
    queryKey: queryKeys.pagePreview(docId, pageIndex, editsKey, activeShareToken),
    queryFn: () =>
      fetchPagePreview(docId, pageIndex, pageEdits, 150, activeShareToken),
    enabled: Boolean(doc),
    staleTime: 2 * 60_000,
  });

  const activePreview =
    preview && preview.key === currentPageKey ? preview : null;
  const isCanvasReady = Boolean(activePreview && activePreview.loaded);

  const revokePreview = useCallback(() => {
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
  }, []);

  useEffect(() => {
    setPreview((prev) => {
      if (prev && prev.key !== currentPageKey) {
        URL.revokeObjectURL(prev.url);
        return null;
      }
      return prev;
    });
    if (doc) {
      onClearSelection();
      onError(null);
    }
  }, [currentPageKey, doc, onClearSelection, onError]);

  useEffect(() => {
    if (!doc || !previewQuery.data) return;
    const nextUrl = URL.createObjectURL(previewQuery.data);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      const keepVisible = Boolean(
        prev && prev.key === currentPageKey && prev.loaded,
      );
      return { key: currentPageKey, url: nextUrl, loaded: keepVisible };
    });
    return () => {
      URL.revokeObjectURL(nextUrl);
    };
  }, [currentPageKey, doc, previewQuery.data]);

  useEffect(() => {
    if (!doc) {
      onBusy(null);
      return;
    }
    if (blocksQuery.isFetching) {
      if (useLocalOcr) {
        if (ocrStatus.stage === "downloading") {
          onBusy(`Downloading offline OCR (${ocrStatus.progress}%)...`);
        } else if (ocrStatus.stage === "initializing") {
          onBusy("Starting offline OCR engine...");
        } else {
          onBusy("Running local OCR...");
        }
      } else {
        onBusy(
          pageInfo?.kind === "scanned"
            ? "Running OCR on scanned page..."
            : "Extracting text blocks...",
        );
      }
    } else if (previewQuery.isFetching) {
      onBusy("Rendering preview...");
    } else {
      onBusy(null);
    }
  }, [
    blocksQuery.isFetching,
    doc,
    ocrStatus.progress,
    ocrStatus.stage,
    onBusy,
    pageInfo?.kind,
    previewQuery.isFetching,
    useLocalOcr,
  ]);

  useEffect(() => {
    const err = blocksQuery.error ?? previewQuery.error;
    if (err) {
      onError(err instanceof Error ? err.message : "Failed to load page.");
    }
  }, [blocksQuery.error, onError, previewQuery.error]);

  return {
    blocks: doc ? (blocksQuery.data ?? []) : [],
    activePreview,
    isCanvasReady,
    setPreview,
    revokePreview,
  };
}
