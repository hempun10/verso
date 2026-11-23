import {
  Eraser,
  ImagePlus,
  MousePointer2,
  PenTool,
  Redo2,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useEditor } from "../context/EditorContext";

export function EditorToolGroup() {
  const { actions, canUndo, canRedo, undo, redo, setSignOpen, setImageOpen } =
    useEditor();

  const toggleWhiteout = () => {
    if (actions.selectedBlock) {
      actions.skippedBlurBlockIdRef.current = actions.selectedBlock.id;
      actions.commitRuns(actions.selectedBlock, actions.draftRunsRef.current);
      actions.setSelectedId(null);
    }
    actions.setSelectedOverlayId(null);
    actions.setToolMode((m) => (m === "whiteout" ? "select" : "whiteout"));
  };

  return (
    <>
      <div
        className="flex items-center gap-0.5 rounded-lg border bg-muted/40 p-0.5"
        role="group"
        aria-label="Editor tools"
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={actions.toolMode === "select" ? "default" : "ghost"}
              size="sm"
              aria-label="Select and edit text"
              aria-pressed={actions.toolMode === "select"}
              className="h-7 gap-1.5 rounded-md px-2.5 text-xs"
              onClick={() => actions.setToolMode("select")}
            >
              <MousePointer2 className="h-3.5 w-3.5" />
              <span>Select</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Select &amp; edit text (V)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={actions.toolMode === "whiteout" ? "default" : "ghost"}
              size="sm"
              aria-label="Whiteout tool"
              aria-pressed={actions.toolMode === "whiteout"}
              className="h-7 gap-1.5 rounded-md px-2.5 text-xs"
              onClick={toggleWhiteout}
            >
              <Eraser className="h-3.5 w-3.5" />
              <span>Whiteout</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Whiteout draw tool (W)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Signature pad"
              className="h-7 gap-1.5 rounded-md px-2.5 text-xs"
              onClick={() => setSignOpen(true)}
            >
              <PenTool className="h-3.5 w-3.5" />
              <span>Sign</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Signature pad (G)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Add image"
              className="h-7 gap-1.5 rounded-md px-2.5 text-xs"
              onClick={() => setImageOpen(true)}
            >
              <ImagePlus className="h-3.5 w-3.5" />
              <span>Image</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Add image / watermark (I)</TooltipContent>
        </Tooltip>
      </div>

      <div className="hidden items-center gap-0.5 sm:flex">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Undo"
              disabled={!canUndo}
              onClick={undo}
            >
              <Undo2 className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Undo (⌘Z)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Redo"
              disabled={!canRedo}
              onClick={redo}
            >
              <Redo2 className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Redo (⇧⌘Z)</TooltipContent>
        </Tooltip>
      </div>
    </>
  );
}
