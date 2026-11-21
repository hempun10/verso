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
      className="fixed right-4 bottom-4 z-50 w-[340px] max-w-[calc(100vw-32px)] overflow-hidden rounded-xl border border-[#2a2b2f] bg-[#141516] text-[#f7f8f8] shadow-[0_20px_60px_-14px_rgba(0,0,0,0.85)]"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-[#1f2023] bg-[#0f1011] px-3.5 py-2.5">
        <div className="flex min-w-0 items-center gap-2 text-xs font-semibold">
          {!isFinished ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[#7170ff]" />
          ) : errorCount > 0 ? (
            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-[#e0705f]" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#3ecf8e]" />
          )}
          <span className="truncate">{title}</span>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            aria-label={collapsed ? "Expand upload list" : "Collapse upload list"}
            onClick={() => setCollapsed((c) => !c)}
            className="cursor-pointer rounded-md p-1 text-[#8a8f98] transition-colors hover:bg-[#1c1d1f] hover:text-[#f7f8f8]"
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
              className="cursor-pointer rounded-md p-1 text-[#8a8f98] transition-colors hover:bg-[#1c1d1f] hover:text-[#f7f8f8]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* File Rows */}
      {!collapsed && (
        <div className="max-h-60 divide-y divide-[#1f2023] overflow-y-auto">
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
                        ? "text-[#f7d8d2]"
                        : "text-[#f7f8f8]",
                    )}
                    title={item.filename}
                  >
                    {item.filename}
                  </div>
                  {item.error && (
                    <div className="mt-0.5 text-[11px] leading-snug text-[#e0705f]">
                      {item.error}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2 pt-0.5">
                {item.status === "queued" && (
                  <Clock className="h-3.5 w-3.5 text-[#62666d]" />
                )}
                {item.status === "uploading" && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#7170ff]" />
                )}
                {item.status === "done" && item.docId && (
                  <>
                    <button
                      type="button"
                      onClick={() => onOpenDocument(item.docId!)}
                      className="cursor-pointer rounded px-1.5 py-0.5 text-[11px] font-medium text-[#7170ff] transition-colors hover:bg-[#7170ff]/15"
                    >
                      Open
                    </button>
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#3ecf8e]" />
                  </>
                )}
                {item.status === "error" && (
                  <AlertCircle className="h-3.5 w-3.5 text-[#e0705f]" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
