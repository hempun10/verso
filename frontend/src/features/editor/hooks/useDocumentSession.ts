import { useCallback, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { fetchDocumentDetail } from "@/api";
import { useDebouncedAutoSave } from "@/hooks/useDebouncedSave";
import { stripFileExtension, triggerDownload } from "@/lib/format";
import { queryKeys } from "@/lib/queryClient";
import { isImageFilename } from "@/lib/validation";
import type { DocumentDetail, DocumentSummary, PageOverlay } from "@/types";
import {
  type DocMeta,
  type EditMap,
  EMPTY_SNAPSHOT,
  type HistorySnapshot,
  INITIAL_DOC_META,
  editsListToMap,
  updateUrlParams,
} from "../types";
import { useDocumentMutations } from "./useDocumentMutations";
import { usePageLoader } from "./usePageLoader";

interface UseDocumentSessionArgs {
  editsMap: EditMap;
  allOverlays: PageOverlay[];
  resetHistory: (snapshot: HistorySnapshot) => void;
  onClearSelection: () => void;
  onRefreshWorkspace: () => Promise<void>;
  onError: (msg: string | null) => void;
}

export function useDocumentSession({
  editsMap,
  allOverlays,
  resetHistory,
  onClearSelection,
  onRefreshWorkspace,
  onError,
}: UseDocumentSessionArgs) {
  const queryClient = useQueryClient();
  const [doc, setDoc] = useState<DocumentSummary | null>(null);
  const [docLoading, setDocLoading] = useState<boolean>(() =>
    Boolean(new URLSearchParams(window.location.search).get("doc")),
  );
  const [docMeta, setDocMeta] = useState<DocMeta>(INITIAL_DOC_META);
  const [activeShareToken, setActiveShareToken] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const [pageIndex, setPageIndex] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const lastSavedKeyRef = useRef<string>("");

  const currentPage = doc?.pages[pageIndex] ?? null;
  const isImageDoc = Boolean(doc && isImageFilename(doc.filename));

  const allEdits = useMemo(() => Object.values(editsMap), [editsMap]);
  const pageOverlays = useMemo(
    () => allOverlays.filter((o) => o.page_index === pageIndex),
    [allOverlays, pageIndex],
  );
  const totalChanges = allEdits.length + allOverlays.length;

  const pageEditsForLoader = useMemo(() => {
    const prefix = `p${pageIndex}_`;
    const matched = allEdits.filter((e) => e.block_id.startsWith(prefix));
    return matched.length > 0 || allEdits.length === 0 ? matched : allEdits;
  }, [allEdits, pageIndex]);

  const loader = usePageLoader({
    doc,
    pageIndex,
    activeShareToken,
    pageEdits: pageEditsForLoader,
    onClearSelection,
    onBusy: setBusy,
    onError,
  });

  const pageBlocks = useMemo(
    () => loader.blocks.filter((b) => b.page_index === pageIndex),
    [loader.blocks, pageIndex],
  );
  const pageEdits = useMemo(() => {
    const pageIds = new Set(pageBlocks.map((b) => b.id));
    return allEdits.filter((e) => pageIds.has(e.block_id));
  }, [allEdits, pageBlocks]);

  const serializedDocState = useMemo(
    () => JSON.stringify({ edits: allEdits, overlays: allOverlays }),
    [allEdits, allOverlays],
  );

  const { saveStateMut, shareMut, exportMut } = useDocumentMutations();

  const resetActiveDocument = useCallback(() => {
    setDoc(null);
    loader.revokePreview();
    onClearSelection();
    resetHistory(EMPTY_SNAPSHOT);
  }, [loader, onClearSelection, resetHistory]);

  const applyUploadedSummary = useCallback(
    (summary: DocumentSummary, userName: string) => {
      lastSavedKeyRef.current = JSON.stringify({ edits: [], overlays: [] });
      setDoc(summary);
      setDocMeta({
        isOwner: true,
        isShared: false,
        shareToken: null,
        version: 1,
        updatedBy: userName,
      });
      setActiveShareToken(null);
      setPageIndex(0);
      onClearSelection();
      resetHistory(EMPTY_SNAPSHOT);
      setSaveStatus("saved");
      updateUrlParams(summary.doc_id, null);
    },
    [onClearSelection, resetHistory],
  );

  const loadSavedDocument = useCallback(
    async (docId: string, shareToken: string | null = null) => {
      onError(null);
      setDocLoading(true);
      loader.revokePreview();
      setBusy("Loading document...");
      try {
        const detail: DocumentDetail = await queryClient.fetchQuery({
          queryKey: queryKeys.documentDetail(docId, shareToken),
          queryFn: () => fetchDocumentDetail(docId, shareToken),
          staleTime: 10_000,
        });
        lastSavedKeyRef.current = JSON.stringify({
          edits: detail.edits,
          overlays: detail.overlays,
        });
        setDoc({
          doc_id: detail.doc_id,
          filename: detail.filename,
          page_count: detail.page_count,
          pages: detail.pages,
        });
        setDocMeta({
          isOwner: detail.is_owner,
          isShared: detail.is_shared,
          shareToken: detail.share_token ?? shareToken,
          version: detail.version,
          updatedBy: detail.updated_by,
        });
        setActiveShareToken(shareToken);
        setPageIndex(0);
        onClearSelection();
        resetHistory({
          edits: editsListToMap(detail.edits),
          overlays: detail.overlays,
        });
        setSaveStatus("saved");
        updateUrlParams(detail.doc_id, shareToken);
      } catch (err: unknown) {
        setDoc(null);
        onError(
          err instanceof Error ? err.message : "Failed to open document.",
        );
      } finally {
        setDocLoading(false);
        setBusy(null);
      }
    },
    [loader, onClearSelection, onError, queryClient, resetHistory],
  );

  const persistCurrentState = useCallback(async () => {
    if (!doc) return;
    if (serializedDocState === lastSavedKeyRef.current) {
      setSaveStatus("saved");
      return;
    }
    setSaveStatus("saving");
    try {
      const res = await saveStateMut.mutateAsync({
        docId: doc.doc_id,
        edits: allEdits,
        overlays: allOverlays,
        shareToken: activeShareToken,
      });
      lastSavedKeyRef.current = serializedDocState;
      setDocMeta((m) => ({
        ...m,
        version: res.version,
        updatedBy: res.updated_by,
      }));
      setSaveStatus("saved");
      void queryClient.invalidateQueries({
        queryKey: queryKeys.documentDetail(doc.doc_id, activeShareToken),
      });
      void onRefreshWorkspace();
    } catch (err: unknown) {
      setSaveStatus("idle");
      onError(err instanceof Error ? err.message : "Failed to save session.");
    }
  }, [
    activeShareToken,
    allEdits,
    allOverlays,
    doc,
    onError,
    onRefreshWorkspace,
    queryClient,
    saveStateMut,
    serializedDocState,
  ]);

  useDebouncedAutoSave({
    enabled: Boolean(doc),
    serializedKey: serializedDocState,
    lastSavedKey: lastSavedKeyRef.current,
    delayMs: 1100,
    onDirty: () => setSaveStatus("idle"),
    onSave: persistCurrentState,
  });

  const handleToggleShare = async (nextShared: boolean) => {
    if (!doc) return;
    const res = await shareMut.mutateAsync({
      docId: doc.doc_id,
      shared: nextShared,
    });
    setDocMeta((m) => ({
      ...m,
      isShared: res.is_shared,
      shareToken: res.share_token ?? null,
    }));
    void queryClient.invalidateQueries({
      queryKey: queryKeys.documentDetail(doc.doc_id, activeShareToken),
    });
    void onRefreshWorkspace();
  };

  const handleExport = async (format?: "pdf" | "png") => {
    if (!doc || exportMut.isPending) return;
    const targetFormat = format ?? (isImageDoc ? "png" : "pdf");
    setBusy(
      targetFormat === "png"
        ? "Exporting edited image..."
        : "Exporting edited PDF...",
    );
    onError(null);
    try {
      const stem = stripFileExtension(doc.filename, "document");
      const blob = await exportMut.mutateAsync({
        format: targetFormat,
        docId: doc.doc_id,
        pageIndex,
        allEdits,
        pageEdits,
        allOverlays,
        pageOverlays,
        shareToken: activeShareToken,
      });
      triggerDownload(blob, `${stem}-edited.${targetFormat}`);
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setBusy(null);
    }
  };

  return {
    doc,
    setDoc,
    docLoading,
    setDocLoading,
    exporting: exportMut.isPending,
    docMeta,
    activeShareToken,
    saveStatus,
    pageIndex,
    setPageIndex,
    blocks: loader.blocks,
    currentPage,
    activePreview: loader.activePreview,
    isCanvasReady: loader.isCanvasReady,
    isImageDoc,
    pageBlocks,
    pageOverlays,
    totalChanges,
    busy,
    setBusy,
    setPreview: loader.setPreview,
    revokePreview: loader.revokePreview,
    resetActiveDocument,
    applyUploadedSummary,
    loadSavedDocument,
    persistCurrentState,
    handleToggleShare,
    handleExport,
  };
}
