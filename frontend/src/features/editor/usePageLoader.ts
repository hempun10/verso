import { useCallback, useEffect, useState } from "react";
import { fetchPageBlocks, fetchPagePreview } from "@/api";
import type { DocumentSummary, TextBlock, TextEdit } from "@/types";
import type { PagePreview } from "./types";

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
  const [blocks, setBlocks] = useState<TextBlock[]>([]);
  const [preview, setPreview] = useState<PagePreview | null>(null);

  const currentPageKey = doc ? `${doc.doc_id}:${pageIndex}` : "";
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
    setBlocks([]);
    setPreview((prev) => {
      if (prev && prev.key !== currentPageKey) {
        URL.revokeObjectURL(prev.url);
        return null;
      }
      return prev;
    });
    if (!doc) return;
    let cancelled = false;
    onClearSelection();
    onBusy(
      doc.pages[pageIndex]?.kind === "scanned"
        ? "Running OCR on scanned page..."
        : "Extracting text blocks...",
    );
    onError(null);

    fetchPageBlocks(doc.doc_id, pageIndex, activeShareToken)
      .then((loaded) => {
        if (!cancelled) setBlocks(loaded);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          onError(err instanceof Error ? err.message : "Failed to load page.");
      })
      .finally(() => {
        if (!cancelled) onBusy(null);
      });

    return () => {
      cancelled = true;
    };
  }, [activeShareToken, currentPageKey, doc, onBusy, onClearSelection, onError, pageIndex]);

  useEffect(() => {
    if (!doc) return;
    const targetKey = `${doc.doc_id}:${pageIndex}`;
    let cancelled = false;
    onBusy("Rendering preview...");

    fetchPagePreview(doc.doc_id, pageIndex, pageEdits, 150, activeShareToken)
      .then((blob) => {
        if (cancelled) return;
        const nextUrl = URL.createObjectURL(blob);
        setPreview((prev) => {
          if (prev) URL.revokeObjectURL(prev.url);
          const keepVisible = Boolean(
            prev && prev.key === targetKey && prev.loaded,
          );
          return { key: targetKey, url: nextUrl, loaded: keepVisible };
        });
      })
      .catch((err: unknown) => {
        if (!cancelled)
          onError(
            err instanceof Error ? err.message : "Failed to render preview.",
          );
      })
      .finally(() => {
        if (!cancelled) onBusy(null);
      });

    return () => {
      cancelled = true;
    };
  }, [activeShareToken, doc, onBusy, onError, pageEdits, pageIndex]);

  return {
    blocks,
    setBlocks,
    activePreview,
    isCanvasReady,
    setPreview,
    revokePreview,
  };
}
