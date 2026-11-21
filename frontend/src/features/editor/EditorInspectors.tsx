import { Eraser } from "lucide-react";
import { InspectorBar } from "@/components/InspectorBar";
import { OverlayInspectorBar } from "@/components/OverlayInspectorBar";
import { Button } from "@/components/ui/button";
import type { useEditorActions } from "./useEditorActions";

interface EditorInspectorsProps {
  editor: ReturnType<typeof useEditorActions>;
  overrideFonts: string[];
}

export function EditorInspectors({
  editor,
  overrideFonts,
}: EditorInspectorsProps) {
  if (editor.selectedBlock && editor.activeRangeStyle) {
    return (
      <InspectorBar
        inspectorRef={editor.inspectorRef}
        selectedBlock={editor.selectedBlock}
        selectedEdit={editor.selectedEdit}
        overrideFonts={overrideFonts}
        activeBold={editor.activeRangeStyle.bold}
        activeItalic={editor.activeRangeStyle.italic}
        activeUnderline={editor.activeRangeStyle.underline}
        activeStrike={editor.activeRangeStyle.strikethrough}
        activeColor={editor.activeRangeStyle.colorHex}
        activeHighlight={editor.activeRangeStyle.highlightHex}
        activeFamilyOverride={editor.activeRangeStyle.fontFamilyOverride}
        activeSizePt={editor.activeRangeStyle.fontSizePt}
        selectedCharCount={editor.selectedCharCount}
        onPointerDownInside={editor.markInspectorPointerDown}
        onUpdateStyle={editor.updateSelectedStyle}
        onTransformCase={editor.transformSelectedCase}
        onRevert={editor.revertSelected}
        onDismiss={() => {
          editor.skippedBlurBlockIdRef.current = editor.selectedBlock!.id;
          editor.setSelectedId(null);
        }}
      />
    );
  }

  if (editor.selectedOverlay) {
    return (
      <OverlayInspectorBar
        overlay={editor.selectedOverlay}
        isCropping={editor.croppingOverlayId === editor.selectedOverlay.id}
        onStartCrop={() => {
          if (editor.selectedOverlay?.kind === "image") {
            editor.handleStartCrop(editor.selectedOverlay);
          }
        }}
        onApplyCrop={editor.handleApplyCrop}
        onResetCrop={editor.handleResetCrop}
        onCancelCrop={editor.handleCancelCrop}
        onUpdate={(patch) =>
          editor.handleUpdateOverlay(editor.selectedOverlay!.id, patch)
        }
        onDuplicate={() =>
          editor.handleDuplicateOverlay(editor.selectedOverlay!)
        }
        onDelete={() => editor.handleDeleteOverlay(editor.selectedOverlay!.id)}
      />
    );
  }

  if (editor.toolMode === "whiteout") {
    return (
      <div className="fixed top-[66px] left-1/2 z-30 flex w-max -translate-x-1/2 items-center gap-2 rounded-full border border-input bg-popover px-3.5 py-1.5 text-xs font-medium text-foreground shadow-xl">
        <Eraser className="h-3.5 w-3.5 text-[#7170ff]" />
        <span>Click and drag anywhere on the page to white out</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[11px]"
          onClick={() => editor.setToolMode("select")}
        >
          Cancel
        </Button>
      </div>
    );
  }

  return null;
}
