import { Folder, Loader2, MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FolderItem } from "@/types";
import { useDashboard } from "./DashboardContext";

interface FolderGridProps {
  folders: FolderItem[];
  compactPill?: boolean;
}

export function FolderGrid({ folders, compactPill = false }: FolderGridProps) {
  const {
    folderMap,
    folderCounts,
    viewMode,
    busyItemId,
    openFolder,
    openContextMenu,
  } = useDashboard();

  if (compactPill) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {folders.map((folder) => {
          const parentName =
            folder.parent_id && folderMap.has(folder.parent_id)
              ? folderMap.get(folder.parent_id)!.name
              : "My Drive";
          const isDeleting = busyItemId === folder.folder_id;
          return (
            <div
              key={folder.folder_id}
              onContextMenu={(e) =>
                openContextMenu(e, { kind: "folder", folder })
              }
              className="group flex items-center justify-between gap-2 rounded-xl border border-border bg-secondary px-3.5 py-2.5 transition-colors hover:border-input hover:bg-surface-hover"
            >
              <button
                type="button"
                onClick={() => openFolder(folder.folder_id)}
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
              >
                <Folder className="h-4 w-4 shrink-0 text-subtle-foreground transition-colors group-hover:text-brand" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-body-sm font-medium text-foreground">
                    {folder.name}
                  </div>
                  <div className="truncate text-label text-dim-foreground">
                    in {parentName}
                  </div>
                </div>
              </button>
              <button
                type="button"
                aria-label={`Folder options for ${folder.name}`}
                disabled={isDeleting}
                onClick={(e) => openContextMenu(e, { kind: "folder", folder })}
                className="cursor-pointer rounded-full p-1 text-dim-foreground transition-colors hover:bg-surface-active hover:text-foreground"
              >
                {isDeleting ? (
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
    <div
      className={cn(
        viewMode === "grid"
          ? "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
          : "divide-y divide-border overflow-hidden rounded-xl border border-border bg-secondary/60",
      )}
    >
      {folders.map((folder) => {
        const counts = folderCounts.get(folder.folder_id) ?? {
          files: 0,
          subfolders: 0,
        };
        const isDeleting = busyItemId === folder.folder_id;
        const subtitle =
          counts.files === 0 && counts.subfolders === 0
            ? "Empty"
            : [
                counts.files > 0
                  ? `${counts.files} ${counts.files === 1 ? "file" : "files"}`
                  : "",
                counts.subfolders > 0
                  ? `${counts.subfolders} ${counts.subfolders === 1 ? "folder" : "folders"}`
                  : "",
              ]
                .filter(Boolean)
                .join(" · ");

        return (
          <div
            key={folder.folder_id}
            onContextMenu={(e) =>
              openContextMenu(e, { kind: "folder", folder })
            }
            className={cn(
              "group flex items-center justify-between gap-2 transition-colors",
              viewMode === "grid"
                ? "rounded-xl border border-border bg-secondary px-3.5 py-2.5 hover:border-input hover:bg-surface-hover"
                : "px-4 py-2.5 hover:bg-surface-hover",
            )}
          >
            <button
              type="button"
              onClick={() => openFolder(folder.folder_id)}
              className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
            >
              <Folder className="h-4 w-4 shrink-0 text-brand" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-body-sm font-medium text-foreground">
                  {folder.name}
                </div>
                <div className="text-label text-dim-foreground tabular-nums">
                  {subtitle}
                </div>
              </div>
            </button>
            <button
              type="button"
              aria-label={`Folder options for ${folder.name}`}
              disabled={isDeleting}
              onClick={(e) => openContextMenu(e, { kind: "folder", folder })}
              className="cursor-pointer rounded-full p-1 text-dim-foreground transition-colors hover:bg-surface-active hover:text-foreground"
            >
              {isDeleting ? (
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
