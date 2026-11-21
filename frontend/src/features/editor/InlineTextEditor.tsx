import {
  cssFontStack,
  editorBackgroundForRuns,
  extractStyle,
  getInitialRuns,
  getSelectionOffsets,
  parseRunsFromDom,
} from "@/lib/runs";
import type { TextBlock } from "@/types";
import { useEditor } from "./EditorContext";

export function InlineTextEditor({ block }: { block: TextBlock }) {
  const { editsMap, zoom, actions } = useEditor();
  const existingEdit = editsMap[block.id] ?? null;
  const [x0, y0, x1, y1] = block.bbox;
  const fallbackStyle =
    actions.draftRuns.length > 0 ? extractStyle(actions.draftRuns[0]) : {};
  const editorBg = editorBackgroundForRuns(block, actions.draftRuns);

  return (
    <div
      ref={actions.editorRef}
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
        actions.draftRunsRef.current = nextRuns;
        actions.setDraftRuns(nextRuns);
        const offsets = getSelectionOffsets(e.currentTarget);
        if (offsets) {
          actions.selectionRangeRef.current = offsets;
          actions.setSelectionRange(offsets);
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
        if (actions.skippedBlurBlockIdRef.current === block.id) {
          actions.skippedBlurBlockIdRef.current = null;
          return;
        }
        actions.commitRuns(block, actions.draftRunsRef.current);
        const nextEl =
          e.relatedTarget instanceof Element ? e.relatedTarget : null;
        const movingToInspector =
          actions.inspectorPointerDownRef.current ||
          Boolean(
            nextEl &&
              (actions.inspectorRef.current?.contains(nextEl) ||
                nextEl.closest("[data-inspector-portal]")),
          );
        if (!movingToInspector) actions.setSelectedId(null);
      }}
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && !e.shiftKey) {
          const k = e.key.toLowerCase();
          if (k === "b") {
            e.preventDefault();
            actions.updateSelectedStyle({
              bold_override: !(actions.activeRangeStyle?.bold ?? false),
            });
            return;
          }
          if (k === "i") {
            e.preventDefault();
            actions.updateSelectedStyle({
              italic_override: !(actions.activeRangeStyle?.italic ?? false),
            });
            return;
          }
          if (k === "u") {
            e.preventDefault();
            actions.updateSelectedStyle({
              underline: !(actions.activeRangeStyle?.underline ?? false),
            });
            return;
          }
        }
        if (
          (e.metaKey || e.ctrlKey) &&
          e.shiftKey &&
          e.key.toLowerCase() === "x"
        ) {
          e.preventDefault();
          actions.updateSelectedStyle({
            strikethrough: !(actions.activeRangeStyle?.strikethrough ?? false),
          });
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          actions.skippedBlurBlockIdRef.current = block.id;
          actions.commitRuns(block, actions.draftRunsRef.current);
          actions.setSelectedId(null);
        } else if (e.key === "Escape") {
          e.preventDefault();
          actions.skippedBlurBlockIdRef.current = block.id;
          const restored = getInitialRuns(block, existingEdit);
          actions.draftRunsRef.current = restored;
          actions.setDraftRuns(restored);
          actions.setSelectedId(null);
        }
      }}
    />
  );
}
