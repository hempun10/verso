import type { MutableRefObject, RefObject } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { OverlayLayer, type CropBox } from "@/components/OverlayLayer";
import { Skeleton } from "@/components/ui/skeleton";
import type { ActiveRangeStyle, SelectionRange } from "@/lib/runs";
import { cn } from "@/lib/utils";
import type {
  ImageOverlay,
  PageOverlay,
  PageInfo,
  TextBlock,
  TextRun,
  TextRunStyle,
  ToolMode,
} from "@/types";
import { InlineTextEditor } from "./InlineTextEditor";
import type { EditMap, PagePreview } from "./types";

interface EditorCanvasProps {
  docLoading: boolean;
  currentPage: PageInfo | null;
  pageIndex: number;
  zoom: number;
  busy: string | null;
  activePreview: PagePreview | null;
  isCanvasReady: boolean;
  pageBlocks: TextBlock[];
  pageOverlays: PageOverlay[];
  editsMap: EditMap;
  totalChanges: number;
  selectedId: string | null;
  selectedOverlayId: string | null;
  croppingOverlayId: string | null;
  draftCrop: CropBox | null;
  toolMode: ToolMode;
  showBoxes: boolean;
  draftRuns: TextRun[];
  activeRangeStyle: ActiveRangeStyle | null;
  editorRef: RefObject<HTMLDivElement | null>;
  inspectorRef: RefObject<HTMLDivElement | null>;
  inspectorPointerDownRef: MutableRefObject<boolean>;
  skippedBlurBlockIdRef: MutableRefObject<string | null>;
  draftRunsRef: MutableRefObject<TextRun[]>;
  selectionRangeRef: MutableRefObject<SelectionRange | null>;
  onPreviewLoaded: (url: string) => void;
  onSelectBlock: (block: TextBlock) => void;
  onDraftRunsChange: (runs: TextRun[]) => void;
  onSelectionRangeChange: (range: SelectionRange) => void;
  onCommitRuns: (block: TextBlock, runs: TextRun[]) => void;
  onUpdateStyle: (patch: Partial<TextRunStyle>) => void;
  onCloseEditor: () => void;
  onSelectOverlay: (id: string) => void;
  onStartCrop: (overlay: ImageOverlay) => void;
  onChangeDraftCrop: (next: CropBox) => void;
  onCreateWhiteout: (bbox: [number, number, number, number]) => void;
  onCommitOverlayBbox: (id: string, bbox: [number, number, number, number]) => void;
  onCommitOverlayAngle: (id: string, angleDeg: number) => void;
}

export function EditorCanvas({
  docLoading,
  currentPage,
  pageIndex,
  zoom,
  busy,
  activePreview,
  isCanvasReady,
  pageBlocks,
  pageOverlays,
  editsMap,
  totalChanges,
  selectedId,
  selectedOverlayId,
  croppingOverlayId,
  draftCrop,
  toolMode,
  showBoxes,
  draftRuns,
  activeRangeStyle,
  editorRef,
  inspectorRef,
  inspectorPointerDownRef,
  skippedBlurBlockIdRef,
  draftRunsRef,
  selectionRangeRef,
  onPreviewLoaded,
  onSelectBlock,
  onDraftRunsChange,
  onSelectionRangeChange,
  onCommitRuns,
  onUpdateStyle,
  onCloseEditor,
  onSelectOverlay,
  onStartCrop,
  onChangeDraftCrop,
  onCreateWhiteout,
  onCommitOverlayBbox,
  onCommitOverlayAngle,
}: EditorCanvasProps) {
  if (docLoading) {
    return (
      <div data-doc-skeleton="true" className="flex flex-col items-center gap-4">
        <div className="relative flex aspect-[612/792] w-[min(740px,92vw)] flex-col gap-5 rounded-md border border-border bg-card p-12 shadow-[0_24px_70px_-20px_rgba(0,0,0,0.8)]">
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
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#7170ff]" />
              <span>{busy || "Loading document..."}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {currentPage && (
        <div
          className="page-canvas relative overflow-visible rounded-sm bg-white shadow-[0_24px_70px_-16px_rgba(0,0,0,0.85)] ring-1 ring-white/10"
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
              onLoad={() => onPreviewLoaded(activePreview.url)}
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
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#7170ff]" />
                  <span>{busy || "Rendering page..."}</span>
                </div>
              </div>
            </div>
          )}

          {isCanvasReady &&
            pageBlocks.map((block) => {
              const [x0, y0, x1, y1] = block.bbox;
              if (block.id === selectedId) {
                return (
                  <InlineTextEditor
                    key={block.id}
                    block={block}
                    existingEdit={editsMap[block.id] ?? null}
                    zoom={zoom}
                    draftRuns={draftRuns}
                    activeRangeStyle={activeRangeStyle}
                    editorRef={editorRef}
                    inspectorRef={inspectorRef}
                    inspectorPointerDownRef={inspectorPointerDownRef}
                    skippedBlurBlockIdRef={skippedBlurBlockIdRef}
                    draftRunsRef={draftRunsRef}
                    selectionRangeRef={selectionRangeRef}
                    onDraftRunsChange={onDraftRunsChange}
                    onSelectionRangeChange={onSelectionRangeChange}
                    onCommitRuns={onCommitRuns}
                    onUpdateStyle={onUpdateStyle}
                    onClose={onCloseEditor}
                  />
                );
              }

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
                    if (e.button !== 0 || toolMode === "whiteout") return;
                    e.preventDefault();
                    onSelectBlock(block);
                  }}
                  onClick={() => {
                    if (toolMode === "whiteout") return;
                    onSelectBlock(block);
                  }}
                />
              );
            })}

          {isCanvasReady && (
            <OverlayLayer
              overlays={pageOverlays}
              pageWidthPt={currentPage.width_pt}
              pageHeightPt={currentPage.height_pt}
              zoom={zoom}
              toolMode={toolMode}
              showBoxes={showBoxes}
              selectedOverlayId={selectedOverlayId}
              croppingOverlayId={croppingOverlayId}
              draftCrop={draftCrop}
              onSelectOverlay={onSelectOverlay}
              onStartCrop={onStartCrop}
              onChangeDraftCrop={onChangeDraftCrop}
              onCreateWhiteout={onCreateWhiteout}
              onCommitBbox={onCommitOverlayBbox}
              onCommitAngle={onCommitOverlayAngle}
            />
          )}
        </div>
      )}

      {totalChanges === 0 && !selectedId && !busy && (
        <div className="flex items-center gap-1.5 rounded-full border border-border bg-card/90 px-3 py-1 text-[11px] text-muted-foreground shadow-sm">
          <Sparkles className="h-3 w-3 text-[#7170ff]" />
          <span>
            Click text to edit, use Whiteout to cover sections, Sign to
            draw/save a signature, or Image for watermarks
          </span>
        </div>
      )}
    </div>
  );
}
