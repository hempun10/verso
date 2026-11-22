import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Keyboard,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useWorkspace } from "@/features/workspace/WorkspaceContext";
import { useEditor } from "./EditorContext";

export function EditorBottomBar() {
  const { setShortcutsOpen } = useWorkspace();
  const { showBoxes, setShowBoxes, zoom, setZoom, session } = useEditor();

  if (!session.doc) return null;
  const pageCount = session.doc.page_count;

  return (
    <div className="fixed bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-input bg-popover px-2.5 py-1 shadow-floating">
      <label className="toggle flex cursor-pointer items-center gap-1.5 px-1 text-xs font-medium text-foreground/90">
        {showBoxes ? (
          <Eye className="h-3.5 w-3.5 text-brand" />
        ) : (
          <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <span>Boxes</span>
        <Switch
          checked={showBoxes}
          onCheckedChange={setShowBoxes}
          aria-label="Show text boxes"
        />
      </label>

      <Separator orientation="vertical" className="h-4" />

      <div className="flex items-center gap-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Zoom out"
              className="h-7 w-7 rounded-full"
              onClick={() =>
                setZoom((z) => Math.max(0.6, +(z - 0.15).toFixed(2)))
              }
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom out (-)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setZoom(1.25)}
              className="min-w-11 cursor-pointer rounded-full px-1.5 py-0.5 text-center text-xs font-medium text-foreground/90 tabular-nums transition-colors hover:bg-accent"
            >
              {Math.round(zoom * 100)}%
            </button>
          </TooltipTrigger>
          <TooltipContent>Reset zoom (0)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Zoom in"
              className="h-7 w-7 rounded-full"
              onClick={() =>
                setZoom((z) => Math.min(2.4, +(z + 0.15).toFixed(2)))
              }
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom in (+)</TooltipContent>
        </Tooltip>
      </div>

      {pageCount > 1 && (
        <>
          <Separator orientation="vertical" className="h-4" />
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Previous page"
              className="h-7 w-7 rounded-full"
              disabled={session.pageIndex === 0}
              onClick={() => session.setPageIndex((i) => Math.max(0, i - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-1.5 text-xs font-medium text-foreground/90 tabular-nums">
              {session.pageIndex + 1} / {pageCount}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Next page"
              className="h-7 w-7 rounded-full"
              disabled={session.pageIndex >= pageCount - 1}
              onClick={() =>
                session.setPageIndex((i) => Math.min(pageCount - 1, i + 1))
              }
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}

      <Separator orientation="vertical" className="h-4" />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Keyboard shortcuts"
            className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
            onClick={() => setShortcutsOpen(true)}
          >
            <Keyboard className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Keyboard shortcuts (?)</TooltipContent>
      </Tooltip>
    </div>
  );
}
