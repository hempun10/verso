import { useState } from "react";
import {
  Check,
  ChevronDown,
  Cloud,
  Download,
  FolderOpen,
  Keyboard,
  Loader2,
  RefreshCw,
  Save,
  Upload,
} from "lucide-react";
import { BRAND_NAME, BrandLogo } from "@/components/BrandLogo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useWorkspace } from "@/features/workspace/context/WorkspaceContext";
import { useEditor } from "../context/EditorContext";

export function EditorDocMenu() {
  const { workspaceLoading, savedDocs, refreshWorkspace, setShortcutsOpen } =
    useWorkspace();
  const { session, setDocsOpen, openDashboard, chooseFile } = useEditor();

  // Colocated menu popover state owned strictly by EditorDocMenu.
  const [docMenuOpen, setDocMenuOpen] = useState(false);

  const { doc, docLoading, currentPage, docMeta, isImageDoc, saveStatus } =
    session;

  const openSavedDocs = () => {
    void refreshWorkspace();
    setDocsOpen(true);
  };

  return (
    <div className="flex min-w-0 items-center gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={openDashboard}
            className="flex shrink-0 cursor-pointer items-center gap-2 rounded-md transition-opacity hover:opacity-85"
          >
            <BrandLogo size={26} />
            {!doc && (
              <span className="text-sm font-semibold tracking-tight text-foreground">
                {BRAND_NAME}
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent>Back to Dashboard</TooltipContent>
      </Tooltip>

      {docLoading && !doc ? (
        <Skeleton className="h-6 w-36 rounded-md" />
      ) : !doc ? (
        workspaceLoading ? (
          <Skeleton className="h-7 w-24 rounded-md" />
        ) : (
          savedDocs.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              aria-label="Saved documents"
              className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={openSavedDocs}
            >
              <FolderOpen className="h-3.5 w-3.5" />
              <span>My Docs</span>
              <Badge variant="secondary" className="px-1.5 py-0 text-2xs">
                {savedDocs.length}
              </Badge>
            </Button>
          )
        )
      ) : (
        <>
          <Popover open={docMenuOpen} onOpenChange={setDocMenuOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Document menu"
                className="flex min-w-0 cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-left transition-colors hover:bg-accent"
              >
                <span
                  className="max-w-45 truncate text-xs font-semibold text-foreground"
                  title={doc.filename}
                >
                  {doc.filename}
                </span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-2">
              <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                <span
                  className="truncate text-xs font-semibold text-foreground"
                  title={doc.filename}
                >
                  {doc.filename}
                </span>
                {currentPage && (
                  <Badge
                    variant={
                      currentPage.kind === "native" ? "native" : "scanned"
                    }
                    className="shrink-0 text-2xs tracking-wider uppercase"
                  >
                    {currentPage.kind}
                  </Badge>
                )}
              </div>
              <div className="px-2 pb-1.5 text-label text-muted-foreground">
                {doc.page_count} page{doc.page_count === 1 ? "" : "s"} · v
                {docMeta.version}
                {docMeta.updatedBy ? ` · ${docMeta.updatedBy}` : ""}
              </div>
              <Separator className="my-1" />
              <div className="flex flex-col gap-0.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 justify-between px-2 text-xs font-normal"
                  onClick={() => {
                    setDocMenuOpen(false);
                    void session.persistCurrentState();
                  }}
                >
                  <span className="flex items-center gap-2">
                    <Save className="h-3.5 w-3.5 text-muted-foreground" />
                    Save session
                  </span>
                  <span className="text-2xs text-muted-foreground">⌘S</span>
                </Button>

                {!docMeta.isOwner && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 justify-start gap-2 px-2 text-xs font-normal"
                    onClick={() => {
                      setDocMenuOpen(false);
                      void session.loadSavedDocument(
                        doc.doc_id,
                        session.activeShareToken,
                      );
                    }}
                  >
                    <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
                    Reload latest changes
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 justify-between px-2 text-xs font-normal"
                  onClick={() => {
                    setDocMenuOpen(false);
                    openSavedDocs();
                  }}
                >
                  <span className="flex items-center gap-2">
                    <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
                    Saved documents
                  </span>
                  <Badge variant="secondary" className="px-1.5 py-0 text-2xs">
                    {savedDocs.length}
                  </Badge>
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 justify-start gap-2 px-2 text-xs font-normal"
                  onClick={() => {
                    setDocMenuOpen(false);
                    chooseFile(null);
                  }}
                >
                  <Upload className="h-3.5 w-3.5 text-muted-foreground" />
                  Open another PDF or image
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 justify-start gap-2 px-2 text-xs font-normal"
                  onClick={() => {
                    setDocMenuOpen(false);
                    void session.handleExport(isImageDoc ? "pdf" : "png");
                  }}
                >
                  <Download className="h-3.5 w-3.5 text-muted-foreground" />
                  {isImageDoc ? "Export as PDF" : "Export page as PNG"}
                </Button>

                <Separator className="my-1" />

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 justify-between px-2 text-xs font-normal"
                  onClick={() => {
                    setDocMenuOpen(false);
                    setShortcutsOpen(true);
                  }}
                >
                  <span className="flex items-center gap-2">
                    <Keyboard className="h-3.5 w-3.5 text-muted-foreground" />
                    Keyboard shortcuts
                  </span>
                  <span className="text-2xs text-muted-foreground">?</span>
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => void session.persistCurrentState()}
                className="hidden cursor-pointer items-center gap-1 rounded-full px-2 py-0.5 text-label text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:flex"
              >
                {saveStatus === "saving" ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Saving</span>
                  </>
                ) : saveStatus === "saved" ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-600" />
                    <span>Saved</span>
                  </>
                ) : (
                  <>
                    <Cloud className="h-3 w-3" />
                    <span>Save</span>
                  </>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent>Save session (⌘S)</TooltipContent>
          </Tooltip>
        </>
      )}
    </div>
  );
}
