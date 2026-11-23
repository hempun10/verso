import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  applyStyleToRange,
  getActiveStyleForRange,
  getInitialRuns,
  getSelectionOffsets,
  renderRunsIntoDom,
  runsToEdit,
  runsToPlainText,
  setSelectionOffsets,
  transformCaseInRange,
  type SelectionRange,
} from "@/lib/runs";
import type {
  PageOverlay,
  TextBlock,
  TextRun,
  TextRunStyle,
  ToolMode,
} from "@/types";
import type { EditMap } from "../types";
import { useOverlayActions } from "./useOverlayActions";

interface UseEditorActionsArgs {
  blocks: TextBlock[];
  pageOverlays: PageOverlay[];
  editsMap: EditMap;
  pageIndex: number;
  zoom: number;
  pushEdits: (updater: (prev: EditMap) => EditMap) => void;
  pushOverlays: (updater: (prev: PageOverlay[]) => PageOverlay[]) => void;
}

export function useEditorActions({
  blocks,
  pageOverlays,
  editsMap,
  pageIndex,
  zoom,
  pushEdits,
  pushOverlays,
}: UseEditorActionsArgs) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toolMode, setToolMode] = useState<ToolMode>("select");
  const [draftRuns, setDraftRuns] = useState<TextRun[]>([]);
  const [selectionRange, setSelectionRange] = useState<SelectionRange | null>(
    null,
  );

  const inspectorRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const inspectorPointerDownRef = useRef(false);
  const skippedBlurBlockIdRef = useRef<string | null>(null);
  const draftRunsRef = useRef<TextRun[]>([]);
  const selectionRangeRef = useRef<SelectionRange | null>(null);

  const overlayActions = useOverlayActions({
    pageOverlays,
    pageIndex,
    pushOverlays,
    setToolMode,
  });

  const selectedBlock = useMemo(
    () => blocks.find((b) => b.id === selectedId) ?? null,
    [blocks, selectedId],
  );
  const selectedEdit = selectedId ? (editsMap[selectedId] ?? null) : null;

  const activeRangeStyle = useMemo(() => {
    if (!selectedBlock) return null;
    return getActiveStyleForRange(selectedBlock, draftRuns, selectionRange);
  }, [selectedBlock, draftRuns, selectionRange]);

  const selectedCharCount = useMemo(() => {
    if (!selectionRange) return 0;
    return Math.max(0, selectionRange.end - selectionRange.start);
  }, [selectionRange]);

  const clearSelection = useCallback(() => {
    setSelectedId(null);
    overlayActions.clearOverlaySelection();
  }, [overlayActions]);

  useLayoutEffect(() => {
    const el = editorRef.current;
    if (!el || !selectedBlock) return;
    renderRunsIntoDom(el, draftRunsRef.current, selectedBlock, zoom);
    el.focus();
    const len = runsToPlainText(draftRunsRef.current).length;
    setSelectionOffsets(el, len, len);
    selectionRangeRef.current = { start: len, end: len };
    setSelectionRange({ start: len, end: len });
  }, [selectedBlock, zoom]);

  useEffect(() => {
    if (!selectedId) return;
    const onSelectionChange = () => {
      const el = editorRef.current;
      if (!el) return;
      const offsets = getSelectionOffsets(el);
      if (offsets) {
        selectionRangeRef.current = offsets;
        setSelectionRange(offsets);
      }
    };
    document.addEventListener("selectionchange", onSelectionChange);
    return () =>
      document.removeEventListener("selectionchange", onSelectionChange);
  }, [selectedId]);

  const markInspectorPointerDown = () => {
    inspectorPointerDownRef.current = true;
    window.setTimeout(() => {
      inspectorPointerDownRef.current = false;
    }, 0);
  };

  const commitRuns = (block: TextBlock, runs: TextRun[]) => {
    const nextEdit = runsToEdit(block, runs);
    const existing = editsMap[block.id] ?? null;
    if (!nextEdit) {
      if (!existing) return;
      pushEdits((prev) => {
        const copy = { ...prev };
        delete copy[block.id];
        return copy;
      });
      return;
    }
    if (existing && JSON.stringify(existing) === JSON.stringify(nextEdit)) {
      return;
    }
    pushEdits((prev) => ({ ...prev, [block.id]: nextEdit }));
  };

  const syncDomFromRuns = (
    block: TextBlock,
    nextRuns: TextRun[],
    restoreRange: SelectionRange | null,
  ) => {
    draftRunsRef.current = nextRuns;
    setDraftRuns(nextRuns);
    const el = editorRef.current;
    if (!el) return;
    const wasFocused = document.activeElement === el;
    renderRunsIntoDom(el, nextRuns, block, zoom);
    if (wasFocused && restoreRange) {
      const len = runsToPlainText(nextRuns).length;
      const s = Math.min(restoreRange.start, len);
      const e = Math.min(restoreRange.end, len);
      setSelectionOffsets(el, s, e);
      selectionRangeRef.current = { start: s, end: e };
      setSelectionRange({ start: s, end: e });
    }
  };

  const selectBlock = (block: TextBlock) => {
    if (selectedId === block.id) return;
    if (selectedBlock && selectedBlock.id !== block.id) {
      skippedBlurBlockIdRef.current = selectedBlock.id;
      commitRuns(selectedBlock, draftRunsRef.current);
    } else if (skippedBlurBlockIdRef.current === block.id) {
      skippedBlurBlockIdRef.current = null;
    }
    overlayActions.setSelectedOverlayId(null);
    const initial = getInitialRuns(block, editsMap[block.id] ?? null);
    draftRunsRef.current = initial;
    setDraftRuns(initial);
    selectionRangeRef.current = null;
    setSelectionRange(null);
    setSelectedId(block.id);
  };

  const updateSelectedStyle = (patch: Partial<TextRunStyle>) => {
    if (!selectedBlock) return;
    const range =
      (editorRef.current ? getSelectionOffsets(editorRef.current) : null) ??
      selectionRangeRef.current;
    const nextRuns = applyStyleToRange(draftRunsRef.current, range, patch);
    syncDomFromRuns(selectedBlock, nextRuns, range);
    commitRuns(selectedBlock, nextRuns);
  };

  const transformSelectedCase = (mode: "upper" | "lower" | "title") => {
    if (!selectedBlock) return;
    const range =
      (editorRef.current ? getSelectionOffsets(editorRef.current) : null) ??
      selectionRangeRef.current;
    const nextRuns = transformCaseInRange(draftRunsRef.current, range, mode);
    syncDomFromRuns(selectedBlock, nextRuns, range);
    commitRuns(selectedBlock, nextRuns);
  };

  const revertSelected = () => {
    if (!selectedBlock) return;
    const original = getInitialRuns(selectedBlock, null);
    const len = runsToPlainText(original).length;
    syncDomFromRuns(selectedBlock, original, { start: len, end: len });
    pushEdits((prev) => {
      if (!prev[selectedBlock.id]) return prev;
      const copy = { ...prev };
      delete copy[selectedBlock.id];
      return copy;
    });
  };

  return {
    selectedId,
    setSelectedId,
    toolMode,
    setToolMode,
    draftRuns,
    setDraftRuns,
    selectionRange,
    setSelectionRange,
    inspectorRef,
    editorRef,
    inspectorPointerDownRef,
    skippedBlurBlockIdRef,
    draftRunsRef,
    selectionRangeRef,
    selectedBlock,
    selectedEdit,
    activeRangeStyle,
    selectedCharCount,
    clearSelection,
    markInspectorPointerDown,
    commitRuns,
    selectBlock,
    updateSelectedStyle,
    transformSelectedCase,
    revertSelected,
    ...overlayActions,
  };
}
