import {
  FileText,
  Folder,
  Image as ImageIcon,
  Loader2,
  MoreVertical,
  Share2,
} from "lucide-react";
import { useEditor } from "@/features/editor/context/EditorContext";
import { formatRelativeTime } from "@/lib/format";
import { isImageFilename } from "@/lib/validation";
import type { DocumentListItem } from "@/types";
import { useDashboard } from "../context/DashboardContext";

export function FileViews({ documents }: { documents: DocumentListItem[] }) {
  const { session } = useEditor();
  const { folderMap, section, viewMode, busyItemId, openContextMenu } =
    useDashboard();

  const onOpenDocument = (id: string) => void session.loadSavedDocument(id);

  if (viewMode === "list") {
    return (
      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-secondary/60">
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
                openContextMenu(e, { kind: "file", doc: item })
              }
              className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-surface-hover"
            >
              <button
                type="button"
                onClick={() => onOpenDocument(item.doc_id)}
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-subtle-foreground">
                  {isImageFilename(item.filename) ? (
                    <ImageIcon className="h-4 w-4 text-brand" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-body-sm font-medium text-foreground">
                      {item.filename}
                    </span>
                    {item.is_shared && (
                      <span className="shrink-0 rounded-full bg-success/12 px-2 py-0.5 text-2xs font-medium text-success">
                        Shared
                      </span>
                    )}
                    {parentFolder && (
                      <span className="hidden shrink-0 items-center gap-1 rounded bg-accent px-1.5 py-0.5 text-2xs text-subtle-foreground sm:inline-flex">
                        <Folder className="h-2.5 w-2.5 text-brand" />
                        {parentFolder.name}
                      </span>
                    )}
                  </div>
                  <div className="text-label text-muted-foreground tabular-nums">
                    {item.page_count} {item.page_count === 1 ? "page" : "pages"}
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
                onClick={(e) => openContextMenu(e, { kind: "file", doc: item })}
                className="cursor-pointer rounded-full p-1.5 text-dim-foreground transition-colors hover:bg-surface-active hover:text-foreground"
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
              openContextMenu(e, { kind: "file", doc: item })
            }
            className="group flex flex-col overflow-hidden rounded-xl border border-border bg-secondary transition-colors hover:border-input hover:bg-surface-hover"
          >
            <button
              type="button"
              onClick={() => onOpenDocument(item.doc_id)}
              className="relative flex h-28 w-full cursor-pointer items-center justify-center border-b border-border bg-canvas-tile p-4 transition-colors group-hover:bg-card"
            >
              <div className="flex h-20 w-16 flex-col justify-between rounded-md border border-input bg-secondary p-2 shadow-sm transition-transform duration-150 group-hover:-translate-y-0.5">
                <div className="space-y-1">
                  <div className="h-1 w-8 rounded-full bg-brand/75" />
                  <div className="h-1 w-full rounded-full bg-input" />
                  <div className="h-1 w-4/5 rounded-full bg-input" />
                  <div className="h-1 w-3/5 rounded-full bg-input" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-3xs font-semibold text-dim-foreground">
                    {isImageFilename(item.filename) ? "IMG" : "PDF"}
                  </span>
                  <span className="text-3xs text-dim-foreground tabular-nums">
                    {item.page_count}p
                  </span>
                </div>
              </div>

              {item.is_shared && (
                <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 rounded-full bg-success/12 px-2 py-0.5 text-2xs font-medium text-success">
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
                  className="truncate text-body-sm font-medium text-foreground"
                  title={item.filename}
                >
                  {item.filename}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1 text-label text-muted-foreground tabular-nums">
                  <span>
                    {item.page_count} {item.page_count === 1 ? "page" : "pages"}
                  </span>
                  {changes > 0 && <span>· {changes} edits</span>}
                  {updated && <span>· {updated}</span>}
                </div>
                {section !== "drive" && parentFolder && (
                  <div className="mt-1 inline-flex items-center gap-1 text-2xs text-brand">
                    <Folder className="h-2.5 w-2.5" />
                    <span className="max-w-32.5 truncate">
                      {parentFolder.name}
                    </span>
                  </div>
                )}
              </button>

              <button
                type="button"
                aria-label={`File options for ${item.filename}`}
                disabled={isBusy}
                onClick={(e) => openContextMenu(e, { kind: "file", doc: item })}
                className="cursor-pointer rounded-full p-1 text-dim-foreground transition-colors hover:bg-surface-active hover:text-foreground"
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
