import { AlertBanner } from "@/components/ui/alert-banner";
import { FileDropOverlay } from "@/components/ui/file-drop-overlay";
import { DashboardCanvas } from "@/features/dashboard/DashboardCanvas";
import { DashboardContextMenu } from "@/features/dashboard/DashboardContextMenu";
import { DashboardHeader } from "@/features/dashboard/DashboardHeader";
import { DashboardModals } from "@/features/dashboard/DashboardModals";
import { DashboardSidebar } from "@/features/dashboard/DashboardSidebar";
import type { DashboardPageProps } from "@/features/dashboard/types";
import { useDashboardState } from "@/features/dashboard/useDashboardState";
import { formatFileSize, MAX_BATCH_UPLOAD_FILES } from "@/lib/validation";

export function DashboardPage({
  documents,
  folders,
  storageUsage,
  loading,
  authLoading,
  isSignedIn,
  user,
  uploadLimits,
  currentFolderId,
  onSelectFolder,
  onOpenDocument,
  onChooseFile,
  onUploadFiles,
  onDeleteDocument,
  onMoveDocument,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onRefresh,
  onOpenAuth,
  onSignOut,
  onOpenShortcuts,
  onGoHome,
  error,
  onDismissError,
}: DashboardPageProps) {
  const s = useDashboardState({
    documents,
    folders,
    storageUsage,
    currentFolderId,
    onSelectFolder,
    onChooseFile,
    onUploadFiles,
    onDeleteDocument,
    onMoveDocument,
    onCreateFolder,
    onRenameFolder,
    onDeleteFolder,
    onRefresh,
  });

  const handleOpenFolder = (folderId: string) => {
    s.setSearch("");
    s.setSection("drive");
    onSelectFolder(folderId);
  };

  const sidebarNode = (
    <DashboardSidebar
      section={s.section}
      activeFolderId={s.activeFolderId}
      documentCount={documents.length}
      sharedCount={s.sharedCount}
      folderTreeRows={s.folderTreeRows}
      folderCounts={s.folderCounts}
      driveTreeExpanded={s.driveTreeExpanded}
      newMenuOpen={s.newMenuOpen}
      mobileNavOpen={s.mobileNavOpen}
      uploadTargetFolderId={s.uploadTargetFolderId}
      usedBytes={s.usedBytes}
      quotaBytes={s.quotaBytes}
      usedPct={s.usedPct}
      progressBarColor={s.progressBarColor}
      onGoHome={onGoHome}
      onSetSection={s.setSection}
      onSelectFolder={onSelectFolder}
      onToggleDriveTree={() => s.setDriveTreeExpanded((v) => !v)}
      onSetNewMenuOpen={s.setNewMenuOpen}
      onCloseMobileNav={() => s.setMobileNavOpen(false)}
      onOpenNewFolder={s.openNewFolderDialog}
      onChooseFile={onChooseFile}
      onOpenContextMenu={s.openContextMenu}
    />
  );

  return (
    <div className="landing-shell flex h-dvh w-full overflow-hidden bg-[#0a0a0b] text-[#f7f8f8] antialiased">
      <aside className="hidden h-full w-[248px] shrink-0 md:block">
        {sidebarNode}
      </aside>

      {s.mobileNavOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => s.setMobileNavOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-[264px] border-r border-[#1f2023] bg-[#0a0a0b] shadow-2xl">
            {sidebarNode}
          </aside>
        </div>
      )}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col p-2 md:py-2.5 md:pr-2.5 md:pl-0">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#1f2023] bg-[#0f1011]">
          <DashboardHeader
            search={s.search}
            searchInputRef={s.searchInputRef}
            viewMode={s.viewMode}
            authLoading={authLoading}
            isSignedIn={isSignedIn}
            user={user}
            onSearchChange={s.setSearch}
            onViewModeChange={s.setViewMode}
            onOpenMobileNav={() => s.setMobileNavOpen(true)}
            onOpenShortcuts={onOpenShortcuts}
            onOpenAuth={onOpenAuth}
            onSignOut={onSignOut}
          />

          {error && (
            <AlertBanner
              message={error}
              onDismiss={onDismissError}
              className="rounded-none border-x-0 border-t-0 px-5"
            />
          )}

          <DashboardCanvas
            section={s.section}
            search={s.search}
            query={s.query}
            loading={loading}
            viewMode={s.viewMode}
            activeFolderId={s.activeFolderId}
            activeFolderName={s.activeFolderName}
            breadcrumbs={s.breadcrumbs}
            visibleFolders={s.visibleFolders}
            visibleDocs={s.visibleDocs}
            totalDocsCount={documents.length}
            folderMap={s.folderMap}
            folderCounts={s.folderCounts}
            suggestedFoldersOpen={s.suggestedFoldersOpen}
            suggestedFilesOpen={s.suggestedFilesOpen}
            busyItemId={s.busyItemId}
            uploadTargetFolderId={s.uploadTargetFolderId}
            storageUsage={storageUsage}
            uploadLimits={uploadLimits}
            usedBytes={s.usedBytes}
            quotaBytes={s.quotaBytes}
            usedPct={s.usedPct}
            progressBarColor={s.progressBarColor}
            onToggleSuggestedFolders={() => s.setSuggestedFoldersOpen((v) => !v)}
            onToggleSuggestedFiles={() => s.setSuggestedFilesOpen((v) => !v)}
            onSelectFolder={onSelectFolder}
            onOpenFolder={handleOpenFolder}
            onOpenDocument={onOpenDocument}
            onChooseFile={onChooseFile}
            onOpenNewFolder={s.openNewFolderDialog}
            onOpenContextMenu={s.openContextMenu}
          />
        </div>
      </div>

      <FileDropOverlay
        visible={s.pageDragging}
        title={`Drop PDFs or images to upload into ${s.uploadTargetLabel}`}
        subtitle={`Up to ${MAX_BATCH_UPLOAD_FILES} files at once · PDF up to ${formatFileSize(uploadLimits.max_pdf_bytes)} · Images up to ${formatFileSize(uploadLimits.max_image_bytes)}`}
      />

      {s.contextMenu && (
        <DashboardContextMenu
          menu={s.contextMenu}
          uploadTargetFolderId={s.uploadTargetFolderId}
          onClose={() => s.setContextMenu(null)}
          onOpenNewFolder={s.openNewFolderDialog}
          onChooseFile={onChooseFile}
          onRefresh={onRefresh}
          onOpenFolder={handleOpenFolder}
          onRenameFolder={(folder) => {
            s.setRenameTarget(folder);
            s.setRenameValue(folder.name);
          }}
          onDeleteFolder={(id) => void s.handleDeleteFolder(id)}
          onOpenDocument={onOpenDocument}
          onMoveDocument={(doc) => s.setMoveTarget(doc)}
          onDeleteDocument={(id) => void s.handleDeleteDoc(id)}
        />
      )}

      <DashboardModals
        newFolderOpen={s.newFolderOpen}
        newFolderName={s.newFolderName}
        newFolderParentLabel={s.newFolderParentLabel}
        creatingFolder={s.creatingFolder}
        onNewFolderOpenChange={s.setNewFolderOpen}
        onNewFolderNameChange={s.setNewFolderName}
        onSubmitNewFolder={() => void s.submitNewFolder()}
        renameTarget={s.renameTarget}
        renameValue={s.renameValue}
        renaming={s.renaming}
        onCloseRename={() => s.setRenameTarget(null)}
        onRenameValueChange={s.setRenameValue}
        onSubmitRename={() => void s.submitRenameFolder()}
        moveTarget={s.moveTarget}
        movingTargetId={s.movingTargetId}
        folderTreeRows={s.folderTreeRows}
        onCloseMove={() => s.setMoveTarget(null)}
        onMoveDoc={(id) => void s.handleMoveDoc(id)}
      />
    </div>
  );
}
