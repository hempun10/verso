import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchPageBlocks, fetchPagePreview } from "@/api";
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
  const [preview, setPreview] = useState<PagePreview | null>(null);

  const docId = doc?.doc_id ?? "";
  const currentPageKey = doc ? `${docId}:${pageIndex}` : "";
  const editsKey = useMemo(() => JSON.stringify(pageEdits), [pageEdits]);

  const blocksQuery = useQuery({
    queryKey: queryKeys.pageBlocks(docId, pageIndex, activeShareToken),
    queryFn: () => fetchPageBlocks(docId, pageIndex, activeShareToken),
    enabled: Boolean(doc),
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
      onBusy(
        doc.pages[pageIndex]?.kind === "scanned"
          ? "Running OCR on scanned page..."
          : "Extracting text blocks...",
      );
    } else if (previewQuery.isFetching) {
      onBusy("Rendering preview...");
    } else {
      onBusy(null);
    }
  }, [blocksQuery.isFetching, doc, onBusy, pageIndex, previewQuery.isFetching]);

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
