import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { LandingPage } from "@/components/LandingPage";
import { TooltipProvider } from "@/components/ui/tooltip";
import { EditorModals } from "@/features/editor/EditorModals";
import { EditorWorkspace } from "@/features/editor/EditorWorkspace";
import { useAppController } from "@/features/workspace/useAppController";

const DashboardPage = lazy(() =>
  import("@/components/DashboardPage").then((m) => ({
    default: m.DashboardPage,
  })),
);

export function App() {
  const {
    error,
    setError,
    showBoxes,
    setShowBoxes,
    zoom,
    setZoom,
    docMenuOpen,
    setDocMenuOpen,
    fileInputRef,
    editsMap,
    canUndo,
    canRedo,
    undo,
    redo,
    session,
    workspace,
    editor,
    upload,
    assetsPlacement,
    dialogs,
    openDashboard,
    goToLanding,
    openFilePickerWithCaptchaCheck,
  } = useAppController();

  return (
    <TooltipProvider delayDuration={250}>
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
          if (editor.selectedBlock) {
            editor.skippedBlurBlockIdRef.current = editor.selectedBlock.id;
            editor.commitRuns(editor.selectedBlock, editor.draftRunsRef.current);
            editor.setSelectedId(null);
          }
          if (editor.croppingOverlayId && editor.draftCrop) {
            editor.handleApplyCrop();
          }
          if (editor.selectedOverlayId) editor.setSelectedOverlayId(null);
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,image/png,image/jpeg,image/webp"
          multiple
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            const targetFolder = upload.uploadTargetFolderRef.current;
            upload.uploadTargetFolderRef.current = null;
            if (files.length > 0) void upload.handleUploadFiles(files, targetFolder);
            e.target.value = "";
          }}
        />

        {session.doc || session.docLoading ? (
          <EditorWorkspace
            session={session}
            workspace={workspace}
            editor={editor}
            editsMap={editsMap}
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={undo}
            onRedo={redo}
            zoom={zoom}
            setZoom={setZoom}
            showBoxes={showBoxes}
            setShowBoxes={setShowBoxes}
            docMenuOpen={docMenuOpen}
            setDocMenuOpen={setDocMenuOpen}
            error={error}
            onDismissError={() => setError(null)}
            onOpenDashboard={openDashboard}
            onChooseFile={() => fileInputRef.current?.click()}
            onUploadHeaderClick={openFilePickerWithCaptchaCheck}
            onOpenSavedDocs={() => {
              void workspace.refreshWorkspace();
              dialogs.setDocsOpen(true);
            }}
            onOpenShortcuts={() => dialogs.setShortcutsOpen(true)}
            onOpenSign={() => dialogs.setSignOpen(true)}
            onOpenImage={() => dialogs.setImageOpen(true)}
            onOpenShare={() => dialogs.setShareOpen(true)}
            onOpenAuth={() => dialogs.setAuthOpen(true)}
          />
        ) : workspace.view === "dashboard" ? (
          <main className="relative flex flex-1 flex-col bg-[#08090a]">
            <Suspense
              fallback={
                <div className="flex h-dvh w-full items-center justify-center bg-[#0a0a0b] text-xs text-[#8a8f98]">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin text-[#7170ff]" />
                  Loading workspace...
                </div>
              }
            >
              <DashboardPage
                documents={workspace.savedDocs}
                folders={workspace.folders}
                storageUsage={workspace.storageUsage}
                loading={workspace.workspaceLoading}
                authLoading={workspace.authLoading}
                isSignedIn={workspace.isSignedIn}
                user={workspace.user}
                uploadLimits={workspace.uploadLimits}
                currentFolderId={workspace.currentFolderId}
                onSelectFolder={workspace.setCurrentFolderId}
                onOpenDocument={(id) => void session.loadSavedDocument(id)}
                onChooseFile={(folderId) => {
                  upload.uploadTargetFolderRef.current = folderId;
                  fileInputRef.current?.click();
                }}
                onUploadFiles={(files, folderId) =>
                  void upload.handleUploadFiles(files, folderId)
                }
                onDeleteDocument={workspace.handleDeleteSavedDoc}
                onMoveDocument={workspace.handleMoveDocToFolder}
                onCreateFolder={workspace.handleCreateFolder}
                onRenameFolder={workspace.handleRenameFolder}
                onDeleteFolder={workspace.handleDeleteFolder}
                onRefresh={() => void workspace.refreshWorkspace(true)}
                onOpenAuth={() => dialogs.setAuthOpen(true)}
                onSignOut={() => void workspace.handleSignOut()}
                onOpenShortcuts={() => dialogs.setShortcutsOpen(true)}
                onGoHome={goToLanding}
                error={error}
                onDismissError={() => setError(null)}
              />
            </Suspense>
          </main>
        ) : (
          <main className="relative flex flex-1 flex-col bg-[#08090a]">
            <LandingPage
              uploadLimits={workspace.uploadLimits}
              captchaRequired={workspace.captchaRequired}
              turnstileSiteKey={workspace.authConfig?.turnstile_site_key ?? ""}
              uploadCaptchaToken={upload.uploadCaptchaToken}
              uploadCaptchaResetKey={upload.uploadCaptchaResetKey}
              onCaptchaToken={upload.setUploadCaptchaToken}
              onChooseFile={openFilePickerWithCaptchaCheck}
              onUploadFiles={(files) => void upload.handleUploadFiles(files, null)}
              authLoading={workspace.authLoading}
              isSignedIn={workspace.isSignedIn}
              user={workspace.user}
              onOpenAuth={() => dialogs.setAuthOpen(true)}
              onOpenDashboard={openDashboard}
              onSignOut={() => void workspace.handleSignOut()}
              onOpenShortcuts={() => dialogs.setShortcutsOpen(true)}
              onOpenLegal={dialogs.setLegalTab}
              error={error}
              onDismissError={() => setError(null)}
            />
          </main>
        )}

        <EditorModals
          workspace={workspace}
          session={session}
          upload={upload}
          assetsPlacement={assetsPlacement}
          dialogs={dialogs}
          onError={setError}
        />
      </div>
    </TooltipProvider>
  );
}
