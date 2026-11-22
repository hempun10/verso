import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  X,
} from "lucide-react";
import { FileTypeIcon } from "@/components/ui/file-type-icon";
import { cn } from "@/lib/utils";

export interface UploadQueueItem {
  id: string;
  filename: string;
  status: "queued" | "uploading" | "done" | "error";
  docId?: string;
  error?: string;
}

interface UploadQueueToastProps {
  items: UploadQueueItem[];
  onOpenDocument: (docId: string) => void;
  onDismiss: () => void;
}

export function UploadQueueToast({
  items,
  onOpenDocument,
  onDismiss,
}: UploadQueueToastProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (items.length === 0) return null;

  const doneCount = items.filter((i) => i.status === "done").length;
  const errorCount = items.filter((i) => i.status === "error").length;
  const activeCount = items.filter(
    (i) => i.status === "queued" || i.status === "uploading",
  ).length;
  const isFinished = activeCount === 0;

  const title = !isFinished
    ? `Uploading ${doneCount + errorCount + 1} of ${items.length} ${items.length === 1 ? "file" : "files"}...`
    : errorCount === 0
      ? `${doneCount} ${doneCount === 1 ? "upload" : "uploads"} complete`
      : `${doneCount} uploaded · ${errorCount} failed`;

  return (
    <div
      data-upload-queue="true"
      className="fixed right-4 bottom-4 z-50 w-85 max-w-[calc(100vw-32px)] overflow-hidden rounded-xl border border-input bg-secondary text-foreground shadow-dialog"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-border bg-card px-3.5 py-2.5">
        <div className="flex min-w-0 items-center gap-2 text-xs font-semibold">
          {!isFinished ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-brand" />
          ) : errorCount > 0 ? (
            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
          )}
          <span className="truncate">{title}</span>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            aria-label={collapsed ? "Expand upload list" : "Collapse upload list"}
            onClick={() => setCollapsed((c) => !c)}
            className="cursor-pointer rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {collapsed ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
          {isFinished && (
            <button
              type="button"
              aria-label="Dismiss upload queue"
              onClick={onDismiss}
              className="cursor-pointer rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* File Rows */}
      {!collapsed && (
        <div className="max-h-60 divide-y divide-border overflow-y-auto">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-start justify-between gap-2.5 px-3.5 py-2.5 text-xs"
            >
              <div className="flex min-w-0 flex-1 items-start gap-2">
                <FileTypeIcon
                  filename={item.filename}
                  className="mt-0.5 h-3.5 w-3.5"
                />
                <div className="min-w-0 flex-1">
                  <div
                    className={cn(
                      "truncate font-medium",
                      item.status === "error"
                        ? "text-danger-text"
                        : "text-foreground",
                    )}
                    title={item.filename}
                  >
                    {item.filename}
                  </div>
                  {item.error && (
                    <div className="mt-0.5 text-label leading-snug text-destructive">
                      {item.error}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2 pt-0.5">
                {item.status === "queued" && (
                  <Clock className="h-3.5 w-3.5 text-dim-foreground" />
                )}
                {item.status === "uploading" && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />
                )}
                {item.status === "done" && item.docId && (
                  <>
                    <button
                      type="button"
                      onClick={() => onOpenDocument(item.docId!)}
                      className="cursor-pointer rounded px-1.5 py-0.5 text-label font-medium text-brand transition-colors hover:bg-brand/15"
                    >
                      Open
                    </button>
                    <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                  </>
                )}
                {item.status === "error" && (
                  <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
