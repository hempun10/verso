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
import type { ToolMode } from "@/types";

interface EditorToolGroupProps {
  toolMode: ToolMode;
  canUndo: boolean;
  canRedo: boolean;
  onSelectTool: () => void;
  onToggleWhiteout: () => void;
  onOpenSign: () => void;
  onOpenImage: () => void;
  onUndo: () => void;
  onRedo: () => void;
}

export function EditorToolGroup({
  toolMode,
  canUndo,
  canRedo,
  onSelectTool,
  onToggleWhiteout,
  onOpenSign,
  onOpenImage,
  onUndo,
  onRedo,
}: EditorToolGroupProps) {
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
              variant={toolMode === "select" ? "default" : "ghost"}
              size="sm"
              aria-label="Select and edit text"
              aria-pressed={toolMode === "select"}
              className="h-7 gap-1.5 rounded-md px-2.5 text-xs"
              onClick={onSelectTool}
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
              variant={toolMode === "whiteout" ? "default" : "ghost"}
              size="sm"
              aria-label="Whiteout tool"
              aria-pressed={toolMode === "whiteout"}
              className="h-7 gap-1.5 rounded-md px-2.5 text-xs"
              onClick={onToggleWhiteout}
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
              onClick={onOpenSign}
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
              onClick={onOpenImage}
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
              onClick={onUndo}
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
              onClick={onRedo}
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
