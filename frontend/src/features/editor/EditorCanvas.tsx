import { Loader2, Sparkles } from "lucide-react";
import { OverlayLayer } from "@/components/OverlayLayer";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useEditor } from "./EditorContext";
import { InlineTextEditor } from "./InlineTextEditor";

export function EditorCanvas() {
  const { editsMap, zoom, showBoxes, session, actions } = useEditor();

  if (session.docLoading) {
    return (
      <div data-doc-skeleton="true" className="flex flex-col items-center gap-4">
        <div className="relative flex aspect-[612/792] w-[min(740px,92vw)] flex-col gap-5 rounded-md border border-border bg-card p-12 shadow-canvas">
          <Skeleton className="h-7 w-2/5" />
          <div className="space-y-2.5 pt-2">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-11/12" />
            <Skeleton className="h-3.5 w-4/5" />
          </div>
          <Skeleton className="mt-2 h-28 w-full rounded-lg" />
          <div className="space-y-2.5 pt-2">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-5/6" />
            <Skeleton className="h-3.5 w-3/4" />
          </div>
          <div className="mt-auto grid grid-cols-2 gap-6 pt-6">
            <div className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          </div>
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="flex items-center gap-2 rounded-full border border-input bg-popover/95 px-4 py-2 text-xs font-medium text-foreground shadow-xl">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />
              <span>{session.busy || "Loading document..."}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const {
    currentPage,
    pageIndex,
    activePreview,
    isCanvasReady,
    pageBlocks,
    totalChanges,
    busy,
  } = session;

  return (
    <div className="flex flex-col items-center gap-4">
      {currentPage && (
        <div
          className="page-canvas relative overflow-visible rounded-sm bg-white shadow-canvas ring-1 ring-white/10"
          style={{
            width: currentPage.width_pt * zoom,
            height: currentPage.height_pt * zoom,
          }}
        >
          {activePreview && (
            <img
              className={cn(
                "page-image block h-full w-full rounded-sm select-none",
                !isCanvasReady && "opacity-0",
              )}
              src={activePreview.url}
              alt={`Page ${pageIndex + 1}`}
              draggable={false}
              onLoad={() =>
                session.setPreview((prev) =>
                  prev && prev.url === activePreview.url
                    ? { ...prev, loaded: true }
                    : prev,
                )
              }
            />
          )}

          {!isCanvasReady && (
            <div
              data-page-skeleton="true"
              className="absolute inset-0 flex h-full w-full flex-col gap-5 rounded-sm bg-card p-12"
            >
              <Skeleton className="h-7 w-2/5" />
              <div className="space-y-2.5 pt-2">
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-11/12" />
                <Skeleton className="h-3.5 w-4/5" />
              </div>
              <Skeleton className="mt-2 h-28 w-full rounded-lg" />
              <div className="space-y-2.5 pt-2">
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-5/6" />
              </div>
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="flex items-center gap-2 rounded-full border border-input bg-popover/95 px-4 py-2 text-xs font-medium text-foreground shadow-xl">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />
                  <span>{busy || "Rendering page..."}</span>
                </div>
              </div>
            </div>
          )}

          {isCanvasReady &&
            pageBlocks.map((block) => {
              if (block.id === actions.selectedId) {
                return <InlineTextEditor key={block.id} block={block} />;
              }
              const [x0, y0, x1, y1] = block.bbox;
              return (
                <button
                  key={block.id}
                  type="button"
                  title={`${block.style.original_font_name} (${block.style.font_size_pt}pt)`}
                  className={cn(
                    "text-hitbox",
                    showBoxes && "hitbox-visible",
                    showBoxes && Boolean(editsMap[block.id]) && "hitbox-edited",
                  )}
                  style={{
                    left: x0 * zoom,
                    top: y0 * zoom,
                    width: Math.max((x1 - x0) * zoom, 12),
                    height: Math.max((y1 - y0) * zoom, 12),
                  }}
                  onMouseDown={(e) => {
                    if (e.button !== 0 || actions.toolMode === "whiteout")
                      return;
                    e.preventDefault();
                    actions.selectBlock(block);
                  }}
                  onClick={() => {
                    if (actions.toolMode === "whiteout") return;
                    actions.selectBlock(block);
                  }}
                />
              );
            })}

          {isCanvasReady && <OverlayLayer />}
        </div>
      )}

      {totalChanges === 0 && !actions.selectedId && !busy && (
        <div className="flex items-center gap-1.5 rounded-full border border-border bg-card/90 px-3 py-1 text-label text-muted-foreground shadow-sm">
          <Sparkles className="h-3 w-3 text-brand" />
          <span>
            Click text to edit, use Whiteout to cover sections, Sign to
            draw/save a signature, or Image for watermarks
          </span>
        </div>
      )}
    </div>
  );
}
