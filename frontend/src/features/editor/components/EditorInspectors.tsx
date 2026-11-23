import { Eraser } from "lucide-react";
import { InspectorBar } from "@/components/InspectorBar";
import { OverlayInspectorBar } from "@/components/OverlayInspectorBar";
import { Button } from "@/components/ui/button";
import { useEditor } from "../context/EditorContext";

export function EditorInspectors() {
  const { actions } = useEditor();

  if (actions.selectedBlock && actions.activeRangeStyle) {
    return <InspectorBar />;
  }

  if (actions.selectedOverlay) {
    return <OverlayInspectorBar />;
  }

  if (actions.toolMode === "whiteout") {
    return (
      <div className="fixed top-16.5 left-1/2 z-30 flex w-max -translate-x-1/2 items-center gap-2 rounded-full border border-input bg-popover px-3.5 py-1.5 text-xs font-medium text-foreground shadow-xl">
        <Eraser className="h-3.5 w-3.5 text-brand" />
        <span>Click and drag anywhere on the page to white out</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-label"
          onClick={() => actions.setToolMode("select")}
        >
          Cancel
        </Button>
      </div>
    );
  }

  return null;
}
