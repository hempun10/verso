import { Download, Loader2, Share2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EditorAccountMenu } from "./EditorAccountMenu";
import { useEditor } from "../context/EditorContext";
import { EditorDocMenu } from "./EditorDocMenu";
import { EditorToolGroup } from "./EditorToolGroup";

export function EditorTopbar() {
  const { session, setShareOpen, chooseFile } = useEditor();

  return (
    <header className="sticky top-0 z-20 grid h-14 grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-border bg-background/95 px-3 backdrop-blur-md sm:gap-4 sm:px-4">
      <EditorDocMenu />

      <div className="flex items-center justify-center gap-2">
        {session.docLoading && !session.doc ? (
          <Skeleton className="h-8 w-72 rounded-lg" />
        ) : (
          session.doc && <EditorToolGroup />
        )}
      </div>

      <div className="flex items-center justify-end gap-2">
        {session.docLoading && !session.doc ? (
          <Skeleton className="h-8 w-28 rounded-md" />
        ) : !session.doc ? (
          <Button
            variant="outline"
            size="default"
            className="hidden sm:inline-flex"
            onClick={() => chooseFile(null, true)}
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Upload file</span>
          </Button>
        ) : (
          <>
            {session.docMeta.isOwner && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={session.docMeta.isShared ? "secondary" : "ghost"}
                    size="default"
                    aria-label="Share document"
                    onClick={() => setShareOpen(true)}
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    <span className="hidden md:inline">
                      {session.docMeta.isShared ? "Shared" : "Share"}
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
                  disabled={session.exporting}
                  className="btn-primary"
                  onClick={() => void session.handleExport()}
                >
                  {session.exporting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  <span>
                    {session.exporting
                      ? "Exporting..."
                      : `Export ${session.isImageDoc ? "PNG" : "PDF"}${session.totalChanges > 0 ? ` (${session.totalChanges})` : ""}`}
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Export edited {session.isImageDoc ? "image" : "PDF"} (⌘E)
              </TooltipContent>
            </Tooltip>
          </>
        )}

        <EditorAccountMenu />
      </div>
    </header>
  );
}
