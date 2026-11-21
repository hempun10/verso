import type React from "react";
import { Folder, Loader2, MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FolderItem } from "@/types";
import type { ContextMenuTarget, FolderCounts, ViewMode } from "./types";

interface FolderGridProps {
  folders: FolderItem[];
  folderMap: Map<string, FolderItem>;
  folderCounts: Map<string, FolderCounts>;
  viewMode: ViewMode;
  compactPill?: boolean;
  busyItemId: string | null;
  onOpenFolder: (folderId: string) => void;
  onOpenContextMenu: (e: React.MouseEvent, target: ContextMenuTarget) => void;
}

export function FolderGrid({
  folders,
  folderMap,
  folderCounts,
  viewMode,
  compactPill = false,
  busyItemId,
  onOpenFolder,
  onOpenContextMenu,
}: FolderGridProps) {
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
                onOpenContextMenu(e, { kind: "folder", folder })
              }
              className="group flex items-center justify-between gap-2 rounded-xl border border-[#1f2023] bg-[#141516] px-3.5 py-2.5 transition-colors hover:border-[#2a2b2f] hover:bg-[#1a1b1f]"
            >
              <button
                type="button"
                onClick={() => onOpenFolder(folder.folder_id)}
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
              >
                <Folder className="h-4 w-4 shrink-0 text-[#a1a1aa] transition-colors group-hover:text-[#7170ff]" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-[#f7f8f8]">
                    {folder.name}
                  </div>
                  <div className="truncate text-[11px] text-[#62666d]">
                    in {parentName}
                  </div>
                </div>
              </button>
              <button
                type="button"
                aria-label={`Folder options for ${folder.name}`}
                disabled={isDeleting}
                onClick={(e) =>
                  onOpenContextMenu(e, { kind: "folder", folder })
                }
                className="cursor-pointer rounded-full p-1 text-[#62666d] transition-colors hover:bg-[#232428] hover:text-[#f7f8f8]"
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
          : "divide-y divide-[#1f2023] overflow-hidden rounded-xl border border-[#1f2023] bg-[#141516]/60",
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
              onOpenContextMenu(e, { kind: "folder", folder })
            }
            className={cn(
              "group flex items-center justify-between gap-2 transition-colors",
              viewMode === "grid"
                ? "rounded-xl border border-[#1f2023] bg-[#141516] px-3.5 py-2.5 hover:border-[#2a2b2f] hover:bg-[#1a1b1f]"
                : "px-4 py-2.5 hover:bg-[#16171a]",
            )}
          >
            <button
              type="button"
              onClick={() => onOpenFolder(folder.folder_id)}
              className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
            >
              <Folder className="h-4 w-4 shrink-0 text-[#7170ff]" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium text-[#f7f8f8]">
                  {folder.name}
                </div>
                <div className="text-[11px] text-[#62666d] tabular-nums">
                  {subtitle}
                </div>
              </div>
            </button>
            <button
              type="button"
              aria-label={`Folder options for ${folder.name}`}
              disabled={isDeleting}
              onClick={(e) => onOpenContextMenu(e, { kind: "folder", folder })}
              className="cursor-pointer rounded-full p-1 text-[#62666d] transition-colors hover:bg-[#232428] hover:text-[#f7f8f8]"
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
