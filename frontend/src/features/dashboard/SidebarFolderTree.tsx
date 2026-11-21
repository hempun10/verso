import type React from "react";
import { ChevronDown, ChevronRight, Folder, HardDrive } from "lucide-react";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  ContextMenuTarget,
  DriveSection,
  FolderCounts,
  FolderTreeRow,
} from "./types";

export function SidebarStorageWidget({
  usedBytes,
  quotaBytes,
  usedPct,
  progressBarColor,
  onManageStorage,
}: {
  usedBytes: number;
  quotaBytes: number;
  usedPct: number;
  progressBarColor: string;
  onManageStorage: () => void;
}) {
  return (
    <div className="mt-1 px-3 pt-1 pb-2" data-storage-widget="true">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#1f2023]">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            progressBarColor,
          )}
          style={{ width: `${usedBytes > 0 ? Math.max(2, usedPct) : 0}%` }}
        />
      </div>
      <p className="mt-2 text-[12px] text-[#a1a1aa] tabular-nums">
        {formatBytes(usedBytes)} of {formatBytes(quotaBytes)} used
      </p>
      <button
        type="button"
        onClick={onManageStorage}
        className="mt-2.5 inline-flex h-8 w-full cursor-pointer items-center justify-center rounded-full border border-[#2a2b2f] bg-transparent text-[12px] font-medium text-[#7170ff] transition-colors hover:border-[#7170ff]/50 hover:bg-[#7170ff]/10"
      >
        Manage storage
      </button>
    </div>
  );
}

interface SidebarFolderTreeProps {
  section: DriveSection;
  activeFolderId: string | null;
  documentCount: number;
  folderTreeRows: FolderTreeRow[];
  folderCounts: Map<string, FolderCounts>;
  driveTreeExpanded: boolean;
  onToggleDriveTree: () => void;
  onSelectRoot: () => void;
  onSelectFolder: (folderId: string) => void;
  onOpenContextMenu: (e: React.MouseEvent, target: ContextMenuTarget) => void;
}

export function SidebarFolderTree({
  section,
  activeFolderId,
  documentCount,
  folderTreeRows,
  folderCounts,
  driveTreeExpanded,
  onToggleDriveTree,
  onSelectRoot,
  onSelectFolder,
  onOpenContextMenu,
}: SidebarFolderTreeProps) {
  return (
    <div className="mt-1 flex flex-col gap-0.5">
      <div
        className={cn(
          "flex items-center rounded-full pr-3 pl-1.5 text-[13px] font-medium transition-colors",
          section === "drive" && activeFolderId === null
            ? "bg-[#7170ff]/18 text-[#f7f8f8]"
            : "text-[#a1a1aa] hover:bg-[#16171a] hover:text-[#f7f8f8]",
        )}
      >
        <button
          type="button"
          aria-label={
            driveTreeExpanded ? "Collapse folders" : "Expand folders"
          }
          onClick={onToggleDriveTree}
          className="flex h-7 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full text-[#62666d] hover:text-[#f7f8f8]"
        >
          {folderTreeRows.length > 0 ? (
            driveTreeExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )
          ) : (
            <span className="w-3" />
          )}
        </button>
        <button
          type="button"
          onClick={onSelectRoot}
          className="flex flex-1 cursor-pointer items-center justify-between py-2 text-left"
        >
          <span className="flex items-center gap-2.5">
            <HardDrive
              className={cn(
                "h-4 w-4 shrink-0",
                section === "drive" && activeFolderId === null
                  ? "text-[#7170ff]"
                  : "text-[#8a8f98]",
              )}
            />
            <span>My Drive</span>
          </span>
          <span className="text-[11px] text-[#62666d] tabular-nums">
            {documentCount}
          </span>
        </button>
      </div>

      {driveTreeExpanded && folderTreeRows.length > 0 && (
        <div className="flex flex-col gap-0.5 py-0.5">
          {folderTreeRows.map(({ folder, depth }) => {
            const isActive =
              section === "drive" && activeFolderId === folder.folder_id;
            const counts = folderCounts.get(folder.folder_id);
            return (
              <button
                key={folder.folder_id}
                type="button"
                onClick={() => onSelectFolder(folder.folder_id)}
                onContextMenu={(e) =>
                  onOpenContextMenu(e, { kind: "folder", folder })
                }
                style={{ paddingLeft: `${26 + depth * 14}px` }}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-2 rounded-full py-1.5 pr-3 text-left text-[12px] transition-colors",
                  isActive
                    ? "bg-[#7170ff]/18 font-medium text-[#f7f8f8]"
                    : "text-[#8a8f98] hover:bg-[#16171a] hover:text-[#f7f8f8]",
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Folder
                    className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      isActive ? "text-[#7170ff]" : "text-[#62666d]",
                    )}
                  />
                  <span className="truncate">{folder.name}</span>
                </span>
                {counts && counts.files > 0 && (
                  <span className="shrink-0 text-[10px] text-[#62666d] tabular-nums">
                    {counts.files}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
