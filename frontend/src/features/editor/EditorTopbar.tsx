import { Download, Loader2, Share2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { DocumentSummary, PageInfo, ToolMode, UserInfo } from "@/types";
import { EditorAccountMenu } from "./EditorAccountMenu";
import { EditorDocMenu } from "./EditorDocMenu";
import { EditorToolGroup } from "./EditorToolGroup";
import type { DocMeta } from "./types";

interface EditorTopbarProps {
  doc: DocumentSummary | null;
  docLoading: boolean;
  workspaceLoading: boolean;
  savedDocsCount: number;
  currentPage: PageInfo | null;
  docMeta: DocMeta;
  isImageDoc: boolean;
  totalChanges: number;
  exporting: boolean;
  saveStatus: "idle" | "saving" | "saved";
  docMenuOpen: boolean;
  toolMode: ToolMode;
  canUndo: boolean;
  canRedo: boolean;
  authLoading: boolean;
  isSignedIn: boolean;
  user: UserInfo | null;
  onDocMenuOpenChange: (open: boolean) => void;
  onOpenDashboard: () => void;
  onPersist: () => void;
  onReloadDoc: () => void;
  onOpenSavedDocs: () => void;
  onChooseFile: () => void;
  onUploadHeaderClick: () => void;
  onExportPrimary: () => void;
  onExportAltFormat: () => void;
  onOpenShortcuts: () => void;
  onSelectTool: () => void;
  onToggleWhiteout: () => void;
  onOpenSign: () => void;
  onOpenImage: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onOpenShare: () => void;
  onOpenAuth: () => void;
  onSignOut: () => void;
}

export function EditorTopbar({
  doc,
  docLoading,
  workspaceLoading,
  savedDocsCount,
  currentPage,
  docMeta,
  isImageDoc,
  totalChanges,
  exporting,
  saveStatus,
  docMenuOpen,
  toolMode,
  canUndo,
  canRedo,
  authLoading,
  isSignedIn,
  user,
  onDocMenuOpenChange,
  onOpenDashboard,
  onPersist,
  onReloadDoc,
  onOpenSavedDocs,
  onChooseFile,
  onUploadHeaderClick,
  onExportPrimary,
  onExportAltFormat,
  onOpenShortcuts,
  onSelectTool,
  onToggleWhiteout,
  onOpenSign,
  onOpenImage,
  onUndo,
  onRedo,
  onOpenShare,
  onOpenAuth,
  onSignOut,
}: EditorTopbarProps) {
  return (
    <header className="sticky top-0 z-20 grid h-14 grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-border bg-background/95 px-3 backdrop-blur-md sm:gap-4 sm:px-4">
      <EditorDocMenu
        doc={doc}
        docLoading={docLoading}
        workspaceLoading={workspaceLoading}
        savedDocsCount={savedDocsCount}
        currentPage={currentPage}
        docMeta={docMeta}
        isImageDoc={isImageDoc}
        saveStatus={saveStatus}
        docMenuOpen={docMenuOpen}
        onDocMenuOpenChange={onDocMenuOpenChange}
        onOpenDashboard={onOpenDashboard}
        onPersist={onPersist}
        onReloadDoc={onReloadDoc}
        onOpenSavedDocs={onOpenSavedDocs}
        onChooseFile={onChooseFile}
        onExportAltFormat={onExportAltFormat}
        onOpenShortcuts={onOpenShortcuts}
      />

      <div className="flex items-center justify-center gap-2">
        {docLoading && !doc ? (
          <Skeleton className="h-8 w-72 rounded-lg" />
        ) : (
          doc && (
            <EditorToolGroup
              toolMode={toolMode}
              canUndo={canUndo}
              canRedo={canRedo}
              onSelectTool={onSelectTool}
              onToggleWhiteout={onToggleWhiteout}
              onOpenSign={onOpenSign}
              onOpenImage={onOpenImage}
              onUndo={onUndo}
              onRedo={onRedo}
            />
          )
        )}
      </div>

      <div className="flex items-center justify-end gap-2">
        {docLoading && !doc ? (
          <Skeleton className="h-8 w-28 rounded-md" />
        ) : !doc ? (
          <Button
            variant="outline"
            size="default"
            className="hidden sm:inline-flex"
            onClick={onUploadHeaderClick}
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Upload file</span>
          </Button>
        ) : (
          <>
            {docMeta.isOwner && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={docMeta.isShared ? "secondary" : "ghost"}
                    size="default"
                    aria-label="Share document"
                    onClick={onOpenShare}
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    <span className="hidden md:inline">
                      {docMeta.isShared ? "Shared" : "Share"}
                    </span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Share edit link</TooltipContent>
              </Tooltip>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="default"
                  size="default"
                  disabled={exporting}
                  className="btn-primary"
                  onClick={onExportPrimary}
                >
                  {exporting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  <span>
                    {exporting
                      ? "Exporting..."
                      : `Export ${isImageDoc ? "PNG" : "PDF"}${totalChanges > 0 ? ` (${totalChanges})` : ""}`}
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Export edited {isImageDoc ? "image" : "PDF"} (⌘E)
              </TooltipContent>
            </Tooltip>
          </>
        )}

        <EditorAccountMenu
          authLoading={authLoading}
          isSignedIn={isSignedIn}
          user={user}
          onOpenAuth={onOpenAuth}
          onSignOut={onSignOut}
        />
      </div>
    </header>
  );
}
