import type React from "react";
import {
  FileText,
  Folder,
  Image as ImageIcon,
  Loader2,
  MoreVertical,
  Share2,
} from "lucide-react";
import { formatRelativeTime } from "@/lib/format";
import { isImageFilename } from "@/lib/validation";
import type { DocumentListItem, FolderItem } from "@/types";
import type { ContextMenuTarget, DriveSection, ViewMode } from "./types";

interface FileViewsProps {
  documents: DocumentListItem[];
  folderMap: Map<string, FolderItem>;
  section: DriveSection;
  viewMode: ViewMode;
  busyItemId: string | null;
  onOpenDocument: (docId: string) => void;
  onOpenContextMenu: (e: React.MouseEvent, target: ContextMenuTarget) => void;
}

export function FileViews({
  documents,
  folderMap,
  section,
  viewMode,
  busyItemId,
  onOpenDocument,
  onOpenContextMenu,
}: FileViewsProps) {
  if (viewMode === "list") {
    return (
      <div className="divide-y divide-[#1f2023] overflow-hidden rounded-xl border border-[#1f2023] bg-[#141516]/60">
        {documents.map((item) => {
          const changes = item.edit_count + item.overlay_count;
          const updated = formatRelativeTime(item.updated_at);
          const parentFolder = item.folder_id
            ? folderMap.get(item.folder_id)
            : null;
          const isBusy = busyItemId === item.doc_id;

          return (
            <div
              key={item.doc_id}
              onContextMenu={(e) =>
                onOpenContextMenu(e, { kind: "file", doc: item })
              }
              className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-[#1a1b1f]"
            >
              <button
                type="button"
                onClick={() => onOpenDocument(item.doc_id)}
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#1f2023] bg-[#0f1011] text-[#a1a1aa]">
                  {isImageFilename(item.filename) ? (
                    <ImageIcon className="h-4 w-4 text-[#7170ff]" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[13px] font-medium text-[#f7f8f8]">
                      {item.filename}
                    </span>
                    {item.is_shared && (
                      <span className="shrink-0 rounded-full bg-[#3ecf8e]/12 px-2 py-0.5 text-[10px] font-medium text-[#3ecf8e]">
                        Shared
                      </span>
                    )}
                    {parentFolder && (
                      <span className="hidden shrink-0 items-center gap-1 rounded bg-[#1c1d1f] px-1.5 py-0.5 text-[10px] text-[#a1a1aa] sm:inline-flex">
                        <Folder className="h-2.5 w-2.5 text-[#7170ff]" />
                        {parentFolder.name}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-[#8a8f98] tabular-nums">
                    {item.page_count}{" "}
                    {item.page_count === 1 ? "page" : "pages"}
                    {changes > 0
                      ? ` · ${changes} ${changes === 1 ? "edit" : "edits"}`
                      : ""}
                    {updated ? ` · ${updated}` : ""}
                  </div>
                </div>
              </button>

              <button
                type="button"
                aria-label={`File options for ${item.filename}`}
                disabled={isBusy}
                onClick={(e) =>
                  onOpenContextMenu(e, { kind: "file", doc: item })
                }
                className="cursor-pointer rounded-full p-1.5 text-[#62666d] transition-colors hover:bg-[#232428] hover:text-[#f7f8f8]"
              >
                {isBusy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <MoreVertical className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {documents.map((item) => {
        const changes = item.edit_count + item.overlay_count;
        const updated = formatRelativeTime(item.updated_at);
        const parentFolder = item.folder_id
          ? folderMap.get(item.folder_id)
          : null;
        const isBusy = busyItemId === item.doc_id;

        return (
          <div
            key={item.doc_id}
            onContextMenu={(e) =>
              onOpenContextMenu(e, { kind: "file", doc: item })
            }
            className="group flex flex-col overflow-hidden rounded-xl border border-[#1f2023] bg-[#141516] transition-colors hover:border-[#2a2b2f] hover:bg-[#191a1e]"
          >
            <button
              type="button"
              onClick={() => onOpenDocument(item.doc_id)}
              className="relative flex h-28 w-full cursor-pointer items-center justify-center border-b border-[#1f2023] bg-[#0b0c0e] p-4 transition-colors group-hover:bg-[#101114]"
            >
              <div className="flex h-20 w-16 flex-col justify-between rounded-md border border-[#2a2b2f] bg-[#141516] p-2 shadow-sm transition-transform duration-150 group-hover:-translate-y-0.5">
                <div className="space-y-1">
                  <div className="h-1 w-8 rounded-full bg-[#7170ff]/75" />
                  <div className="h-1 w-full rounded-full bg-[#2a2b2f]" />
                  <div className="h-1 w-4/5 rounded-full bg-[#2a2b2f]" />
                  <div className="h-1 w-3/5 rounded-full bg-[#2a2b2f]" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[8px] font-semibold text-[#62666d]">
                    {isImageFilename(item.filename) ? "IMG" : "PDF"}
                  </span>
                  <span className="text-[8px] text-[#62666d] tabular-nums">
                    {item.page_count}p
                  </span>
                </div>
              </div>

              {item.is_shared && (
                <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 rounded-full bg-[#3ecf8e]/12 px-2 py-0.5 text-[10px] font-medium text-[#3ecf8e]">
                  <Share2 className="h-2.5 w-2.5" />
                  Shared
                </span>
              )}
            </button>

            <div className="flex items-center justify-between gap-2 p-3">
              <button
                type="button"
                onClick={() => onOpenDocument(item.doc_id)}
                className="min-w-0 flex-1 cursor-pointer text-left"
              >
                <div
                  className="truncate text-[13px] font-medium text-[#f7f8f8]"
                  title={item.filename}
                >
                  {item.filename}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-[#8a8f98] tabular-nums">
                  <span>
                    {item.page_count}{" "}
                    {item.page_count === 1 ? "page" : "pages"}
                  </span>
                  {changes > 0 && <span>· {changes} edits</span>}
                  {updated && <span>· {updated}</span>}
                </div>
                {section !== "drive" && parentFolder && (
                  <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-[#7170ff]">
                    <Folder className="h-2.5 w-2.5" />
                    <span className="max-w-[130px] truncate">
                      {parentFolder.name}
                    </span>
                  </div>
                )}
              </button>

              <button
                type="button"
                aria-label={`File options for ${item.filename}`}
                disabled={isBusy}
                onClick={(e) =>
                  onOpenContextMenu(e, { kind: "file", doc: item })
                }
                className="cursor-pointer rounded-full p-1 text-[#62666d] transition-colors hover:bg-[#232428] hover:text-[#f7f8f8]"
              >
                {isBusy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <MoreVertical className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
