import { Loader2 } from "lucide-react";
import { AlertBanner } from "@/components/ui/alert-banner";
import type { useWorkspace } from "@/features/workspace/useWorkspace";
import { EditorBottomBar } from "./EditorBottomBar";
import { EditorCanvas } from "./EditorCanvas";
import { EditorInspectors } from "./EditorInspectors";
import { EditorTopbar } from "./EditorTopbar";
import type { EditMap } from "./types";
import type { useDocumentSession } from "./useDocumentSession";
import type { useEditorActions } from "./useEditorActions";

interface EditorWorkspaceProps {
  session: ReturnType<typeof useDocumentSession>;
  workspace: ReturnType<typeof useWorkspace>;
  editor: ReturnType<typeof useEditorActions>;
  editsMap: EditMap;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  showBoxes: boolean;
  setShowBoxes: React.Dispatch<React.SetStateAction<boolean>>;
  docMenuOpen: boolean;
  setDocMenuOpen: (open: boolean) => void;
  error: string | null;
  onDismissError: () => void;
  onOpenDashboard: () => void;
  onChooseFile: () => void;
  onUploadHeaderClick: () => void;
  onOpenSavedDocs: () => void;
  onOpenShortcuts: () => void;
  onOpenSign: () => void;
  onOpenImage: () => void;
  onOpenShare: () => void;
  onOpenAuth: () => void;
}

export function EditorWorkspace({
  session,
  workspace,
  editor,
  editsMap,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  zoom,
  setZoom,
  showBoxes,
  setShowBoxes,
  docMenuOpen,
  setDocMenuOpen,
  error,
  onDismissError,
  onOpenDashboard,
  onChooseFile,
  onUploadHeaderClick,
  onOpenSavedDocs,
  onOpenShortcuts,
  onOpenSign,
  onOpenImage,
  onOpenShare,
  onOpenAuth,
}: EditorWorkspaceProps) {
  return (
    <>
      <EditorTopbar
        doc={session.doc}
        docLoading={session.docLoading}
        workspaceLoading={workspace.workspaceLoading}
        savedDocsCount={workspace.savedDocs.length}
        currentPage={session.currentPage}
        docMeta={session.docMeta}
        isImageDoc={session.isImageDoc}
        totalChanges={session.totalChanges}
        exporting={session.exporting}
        saveStatus={session.saveStatus}
        docMenuOpen={docMenuOpen}
        toolMode={editor.toolMode}
        canUndo={canUndo}
        canRedo={canRedo}
        authLoading={workspace.authLoading}
        isSignedIn={workspace.isSignedIn}
        user={workspace.user}
        onDocMenuOpenChange={setDocMenuOpen}
        onOpenDashboard={onOpenDashboard}
        onPersist={() => void session.persistCurrentState()}
        onReloadDoc={() => {
          if (session.doc) {
            void session.loadSavedDocument(
              session.doc.doc_id,
              session.activeShareToken,
            );
          }
        }}
        onOpenSavedDocs={onOpenSavedDocs}
        onChooseFile={onChooseFile}
        onUploadHeaderClick={onUploadHeaderClick}
        onExportPrimary={() => void session.handleExport()}
        onExportAltFormat={() =>
          void session.handleExport(session.isImageDoc ? "pdf" : "png")
        }
        onOpenShortcuts={onOpenShortcuts}
        onSelectTool={() => editor.setToolMode("select")}
        onToggleWhiteout={() => {
          if (editor.selectedBlock) {
            editor.skippedBlurBlockIdRef.current = editor.selectedBlock.id;
            editor.commitRuns(
              editor.selectedBlock,
              editor.draftRunsRef.current,
            );
            editor.setSelectedId(null);
          }
          editor.setSelectedOverlayId(null);
          editor.setToolMode((m) =>
            m === "whiteout" ? "select" : "whiteout",
          );
        }}
        onOpenSign={onOpenSign}
        onOpenImage={onOpenImage}
        onUndo={onUndo}
        onRedo={onRedo}
        onOpenShare={onOpenShare}
        onOpenAuth={onOpenAuth}
        onSignOut={() => void workspace.handleSignOut()}
      />

      {error && (
        <AlertBanner
          message={error}
          onDismiss={onDismissError}
          className="rounded-none border-x-0 border-t-0 px-4"
        />
      )}

      <EditorInspectors
        editor={editor}
        overrideFonts={workspace.overrideFonts}
      />

      <main className="studio-grid relative flex flex-1 flex-col items-center overflow-auto px-5 pt-16 pb-20">
        <EditorCanvas
          docLoading={session.docLoading}
          currentPage={session.currentPage}
          pageIndex={session.pageIndex}
          zoom={zoom}
          busy={session.busy}
          activePreview={session.activePreview}
          isCanvasReady={session.isCanvasReady}
          pageBlocks={session.pageBlocks}
          pageOverlays={session.pageOverlays}
          editsMap={editsMap}
          totalChanges={session.totalChanges}
          selectedId={editor.selectedId}
          selectedOverlayId={editor.selectedOverlayId}
          croppingOverlayId={editor.croppingOverlayId}
          draftCrop={editor.draftCrop}
          toolMode={editor.toolMode}
          showBoxes={showBoxes}
          draftRuns={editor.draftRuns}
          activeRangeStyle={editor.activeRangeStyle}
          editorRef={editor.editorRef}
          inspectorRef={editor.inspectorRef}
          inspectorPointerDownRef={editor.inspectorPointerDownRef}
          skippedBlurBlockIdRef={editor.skippedBlurBlockIdRef}
          draftRunsRef={editor.draftRunsRef}
          selectionRangeRef={editor.selectionRangeRef}
          onPreviewLoaded={(url) =>
            session.setPreview((prev) =>
              prev && prev.url === url ? { ...prev, loaded: true } : prev,
            )
          }
          onSelectBlock={editor.selectBlock}
          onDraftRunsChange={editor.setDraftRuns}
          onSelectionRangeChange={editor.setSelectionRange}
          onCommitRuns={editor.commitRuns}
          onUpdateStyle={editor.updateSelectedStyle}
          onCloseEditor={() => editor.setSelectedId(null)}
          onSelectOverlay={(id) => {
            if (editor.croppingOverlayId && editor.croppingOverlayId !== id) {
              editor.handleApplyCrop();
            }
            if (editor.selectedBlock) {
              editor.skippedBlurBlockIdRef.current = editor.selectedBlock.id;
              editor.commitRuns(
                editor.selectedBlock,
                editor.draftRunsRef.current,
              );
              editor.setSelectedId(null);
            }
            editor.setSelectedOverlayId(id);
          }}
          onStartCrop={editor.handleStartCrop}
          onChangeDraftCrop={editor.setDraftCrop}
          onCreateWhiteout={editor.handleCreateWhiteout}
          onCommitOverlayBbox={(id, bbox) =>
            editor.handleUpdateOverlay(id, { bbox })
          }
          onCommitOverlayAngle={(id, angleDeg) =>
            editor.handleUpdateOverlay(id, { angle_deg: angleDeg })
          }
        />

        {session.doc && (
          <EditorBottomBar
            showBoxes={showBoxes}
            zoom={zoom}
            pageIndex={session.pageIndex}
            pageCount={session.doc.page_count}
            onShowBoxesChange={setShowBoxes}
            onZoomOut={() =>
              setZoom((z) => Math.max(0.6, +(z - 0.15).toFixed(2)))
            }
            onResetZoom={() => setZoom(1.25)}
            onZoomIn={() =>
              setZoom((z) => Math.min(2.4, +(z + 0.15).toFixed(2)))
            }
            onPrevPage={() => session.setPageIndex((i) => Math.max(0, i - 1))}
            onNextPage={() =>
              session.setPageIndex((i) =>
                Math.min(session.doc!.page_count - 1, i + 1),
              )
            }
            onOpenShortcuts={onOpenShortcuts}
          />
        )}

        {session.busy &&
          !session.docLoading &&
          (!session.doc || session.isCanvasReady) && (
            <div className="pointer-events-none fixed right-5 bottom-5 z-30 flex items-center gap-2 rounded-full border border-input bg-popover px-3.5 py-2 text-xs font-medium text-foreground shadow-xl">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#7170ff]" />
              <span>{session.busy}</span>
            </div>
          )}
      </main>
    </>
  );
}
