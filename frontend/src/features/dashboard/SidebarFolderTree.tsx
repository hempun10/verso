import { useState } from "react";
import { ChevronDown, ChevronRight, Folder, HardDrive } from "lucide-react";
import { useWorkspace } from "@/features/workspace/WorkspaceContext";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useDashboard } from "./DashboardContext";

export function SidebarStorageWidget() {
  const {
    usedBytes,
    quotaBytes,
    usedPct,
    progressBarColor,
    setSection,
    setMobileNavOpen,
  } = useDashboard();

  return (
    <div className="mt-1 px-3 pt-1 pb-2" data-storage-widget="true">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            progressBarColor,
          )}
          style={{ width: `${usedBytes > 0 ? Math.max(2, usedPct) : 0}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-subtle-foreground tabular-nums">
        {formatBytes(usedBytes)} of {formatBytes(quotaBytes)} used
      </p>
      <button
        type="button"
        onClick={() => {
          setSection("storage");
          setMobileNavOpen(false);
        }}
        className="mt-2.5 inline-flex h-8 w-full cursor-pointer items-center justify-center rounded-full border border-input bg-transparent text-xs font-medium text-brand transition-colors hover:border-brand/50 hover:bg-brand/10"
      >
        Manage storage
      </button>
    </div>
  );
}

export function SidebarFolderTree() {
  const { savedDocs, setCurrentFolderId } = useWorkspace();
  const {
    section,
    setSection,
    activeFolderId,
    folderTreeRows,
    folderCounts,
    setMobileNavOpen,
    openContextMenu,
  } = useDashboard();

  // Colocated tree collapse state owned strictly by this component.
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="mt-1 flex flex-col gap-0.5">
      <div
        className={cn(
          "flex items-center rounded-full pr-3 pl-1.5 text-body-sm font-medium transition-colors",
          section === "drive" && activeFolderId === null
            ? "bg-brand/18 text-foreground"
            : "text-subtle-foreground hover:bg-surface-hover hover:text-foreground",
        )}
      >
        <button
          type="button"
          aria-label={expanded ? "Collapse folders" : "Expand folders"}
          onClick={() => setExpanded((v) => !v)}
          className="flex h-7 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full text-dim-foreground hover:text-foreground"
        >
          {folderTreeRows.length > 0 ? (
            expanded ? (
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
          onClick={() => {
            setSection("drive");
            setCurrentFolderId(null);
            setMobileNavOpen(false);
          }}
          className="flex flex-1 cursor-pointer items-center justify-between py-2 text-left"
        >
          <span className="flex items-center gap-2.5">
            <HardDrive
              className={cn(
                "h-4 w-4 shrink-0",
                section === "drive" && activeFolderId === null
                  ? "text-brand"
                  : "text-muted-foreground",
              )}
            />
            <span>My Drive</span>
          </span>
          <span className="text-label text-dim-foreground tabular-nums">
            {savedDocs.length}
          </span>
        </button>
      </div>

      {expanded && folderTreeRows.length > 0 && (
        <div className="flex flex-col gap-0.5 py-0.5">
          {folderTreeRows.map(({ folder, depth }) => {
            const isActive =
              section === "drive" && activeFolderId === folder.folder_id;
            const counts = folderCounts.get(folder.folder_id);
            return (
              <button
                key={folder.folder_id}
                type="button"
                onClick={() => {
                  setSection("drive");
                  setCurrentFolderId(folder.folder_id);
                  setMobileNavOpen(false);
                }}
                onContextMenu={(e) =>
                  openContextMenu(e, { kind: "folder", folder })
                }
                style={{ paddingLeft: `${26 + depth * 14}px` }}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-2 rounded-full py-1.5 pr-3 text-left text-xs transition-colors",
                  isActive
                    ? "bg-brand/18 font-medium text-foreground"
                    : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Folder
                    className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      isActive ? "text-brand" : "text-dim-foreground",
                    )}
                  />
                  <span className="truncate">{folder.name}</span>
                </span>
                {counts && counts.files > 0 && (
                  <span className="shrink-0 text-2xs text-dim-foreground tabular-nums">
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
