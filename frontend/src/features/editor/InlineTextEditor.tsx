import type { MutableRefObject, RefObject } from "react";
import {
  cssFontStack,
  editorBackgroundForRuns,
  extractStyle,
  getInitialRuns,
  getSelectionOffsets,
  parseRunsFromDom,
  type ActiveRangeStyle,
  type SelectionRange,
} from "@/lib/runs";
import type { TextBlock, TextEdit, TextRun, TextRunStyle } from "@/types";

interface InlineTextEditorProps {
  block: TextBlock;
  existingEdit: TextEdit | null;
  zoom: number;
  draftRuns: TextRun[];
  activeRangeStyle: ActiveRangeStyle | null;
  editorRef: RefObject<HTMLDivElement | null>;
  inspectorRef: RefObject<HTMLDivElement | null>;
  inspectorPointerDownRef: MutableRefObject<boolean>;
  skippedBlurBlockIdRef: MutableRefObject<string | null>;
  draftRunsRef: MutableRefObject<TextRun[]>;
  selectionRangeRef: MutableRefObject<SelectionRange | null>;
  onDraftRunsChange: (runs: TextRun[]) => void;
  onSelectionRangeChange: (range: SelectionRange) => void;
  onCommitRuns: (block: TextBlock, runs: TextRun[]) => void;
  onUpdateStyle: (patch: Partial<TextRunStyle>) => void;
  onClose: () => void;
}

export function InlineTextEditor({
  block,
  existingEdit,
  zoom,
  draftRuns,
  activeRangeStyle,
  editorRef,
  inspectorRef,
  inspectorPointerDownRef,
  skippedBlurBlockIdRef,
  draftRunsRef,
  selectionRangeRef,
  onDraftRunsChange,
  onSelectionRangeChange,
  onCommitRuns,
  onUpdateStyle,
  onClose,
}: InlineTextEditorProps) {
  const [x0, y0, x1, y1] = block.bbox;
  const fallbackStyle = draftRuns.length > 0 ? extractStyle(draftRuns[0]) : {};
  const editorBg = editorBackgroundForRuns(block, draftRuns);

  return (
    <div
      ref={editorRef}
      role="textbox"
      aria-label="Edit text block"
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      tabIndex={0}
      className="inline-editor"
      style={{
        left: x0 * zoom,
        top: y0 * zoom,
        minWidth: Math.max((x1 - x0) * zoom + 24, 90),
        minHeight: Math.max((y1 - y0) * zoom, 12),
        fontSize: block.style.font_size_pt * zoom,
        fontFamily: cssFontStack(
          block.style.font_family,
          block.style.serif,
          block.style.mono,
        ),
        color: block.style.color_hex,
        backgroundColor: editorBg,
      }}
      onInput={(e) => {
        const nextRuns = parseRunsFromDom(e.currentTarget, fallbackStyle);
        draftRunsRef.current = nextRuns;
        onDraftRunsChange(nextRuns);
        const offsets = getSelectionOffsets(e.currentTarget);
        if (offsets) {
          selectionRangeRef.current = offsets;
          onSelectionRangeChange(offsets);
        }
      }}
      onPaste={(e) => {
        e.preventDefault();
        const text = e.clipboardData
          .getData("text/plain")
          .replace(/\r?\n/g, " ");
        document.execCommand("insertText", false, text);
      }}
      onBlur={(e) => {
        if (skippedBlurBlockIdRef.current === block.id) {
          skippedBlurBlockIdRef.current = null;
          return;
        }
        onCommitRuns(block, draftRunsRef.current);
        const nextEl =
          e.relatedTarget instanceof Element ? e.relatedTarget : null;
        const movingToInspector =
          inspectorPointerDownRef.current ||
          Boolean(
            nextEl &&
              (inspectorRef.current?.contains(nextEl) ||
                nextEl.closest("[data-inspector-portal]")),
          );
        if (!movingToInspector) onClose();
      }}
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && !e.shiftKey) {
          const k = e.key.toLowerCase();
          if (k === "b") {
            e.preventDefault();
            onUpdateStyle({ bold_override: !(activeRangeStyle?.bold ?? false) });
            return;
          }
          if (k === "i") {
            e.preventDefault();
            onUpdateStyle({
              italic_override: !(activeRangeStyle?.italic ?? false),
            });
            return;
          }
          if (k === "u") {
            e.preventDefault();
            onUpdateStyle({ underline: !(activeRangeStyle?.underline ?? false) });
            return;
          }
        }
        if (
          (e.metaKey || e.ctrlKey) &&
          e.shiftKey &&
          e.key.toLowerCase() === "x"
        ) {
          e.preventDefault();
          onUpdateStyle({
            strikethrough: !(activeRangeStyle?.strikethrough ?? false),
          });
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          skippedBlurBlockIdRef.current = block.id;
          onCommitRuns(block, draftRunsRef.current);
          onClose();
        } else if (e.key === "Escape") {
          e.preventDefault();
          skippedBlurBlockIdRef.current = block.id;
          const restored = getInitialRuns(block, existingEdit);
          draftRunsRef.current = restored;
          onDraftRunsChange(restored);
          onClose();
        }
      }}
    />
  );
}
