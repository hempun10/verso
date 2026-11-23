import { Loader2 } from "lucide-react";
import { AlertBanner } from "@/components/ui/alert-banner";
import { useWorkspace } from "@/features/workspace/context/WorkspaceContext";
import { EditorBottomBar } from "./EditorBottomBar";
import { EditorCanvas } from "./EditorCanvas";
import { useEditor } from "../context/EditorContext";
import { EditorInspectors } from "./EditorInspectors";
import { EditorTopbar } from "./EditorTopbar";

export function EditorWorkspace() {
  const { error, clearError } = useWorkspace();
  const { session, actions } = useEditor();

  return (
    <div
      className="app-shell flex min-h-screen flex-col bg-background text-foreground"
      onMouseDown={(e) => {
        const target = e.target as HTMLElement;
        if (
          target.closest(".inline-editor") ||
          target.closest(".inspector-bar") ||
          target.closest("[data-inspector-portal]") ||
          target.closest(".text-hitbox") ||
          target.closest(".pdf-overlay") ||
          target.closest("[data-whiteout-draw-layer]")
        ) {
          return;
        }
        if (actions.selectedBlock) {
          actions.skippedBlurBlockIdRef.current = actions.selectedBlock.id;
          actions.commitRuns(actions.selectedBlock, actions.draftRunsRef.current);
          actions.setSelectedId(null);
        }
        if (actions.croppingOverlayId && actions.draftCrop) {
          actions.handleApplyCrop();
        }
        if (actions.selectedOverlayId) {
          actions.setSelectedOverlayId(null);
        }
      }}
    >
      <EditorTopbar />

      {error && (
        <AlertBanner
          message={error}
          onDismiss={clearError}
          className="rounded-none border-x-0 border-t-0 px-4"
        />
      )}

      <EditorInspectors />

      <main className="studio-grid relative flex flex-1 flex-col items-center overflow-auto px-5 pt-16 pb-20">
        <EditorCanvas />
        {session.doc && <EditorBottomBar />}

        {session.busy &&
          !session.docLoading &&
          (!session.doc || session.isCanvasReady) && (
            <div className="pointer-events-none fixed right-5 bottom-5 z-30 flex items-center gap-2 rounded-full border border-input bg-popover px-3.5 py-2 text-xs font-medium text-foreground shadow-xl">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />
              <span>{session.busy}</span>
            </div>
          )}
      </main>
    </div>
  );
}
