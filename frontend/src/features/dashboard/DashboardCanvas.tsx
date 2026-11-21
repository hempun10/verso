import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useWorkspace } from "@/features/workspace/WorkspaceContext";
import { cn } from "@/lib/utils";
import { useDashboard } from "./DashboardContext";
import {
  DashboardEmptyState,
  DashboardSkeleton,
  StorageSummaryCard,
} from "./DashboardEmptyStates";
import { FileViews } from "./FileViews";
import { FolderGrid } from "./FolderGrid";

export function DashboardCanvas() {
  const { workspaceLoading, setCurrentFolderId } = useWorkspace();
  const {
    section,
    search,
    query,
    activeFolderId,
    breadcrumbs,
    visibleFolders,
    visibleDocs,
    openContextMenu,
  } = useDashboard();

  // Colocated section-collapse toggles owned strictly by DashboardCanvas.
  const [suggestedFoldersOpen, setSuggestedFoldersOpen] = useState(true);
  const [suggestedFilesOpen, setSuggestedFilesOpen] = useState(true);

  const isEmpty = visibleFolders.length === 0 && visibleDocs.length === 0;

  return (
    <main
      data-drive-canvas="true"
      onContextMenu={(e) => openContextMenu(e, { kind: "canvas" })}
      className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-6 sm:px-7"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 pb-5">
        {section === "home" && !query ? (
          <h1 className="text-[22px] font-medium tracking-tight text-[#f7f8f8]">
            Welcome to verso
          </h1>
        ) : section === "drive" && !query ? (
          <div className="flex flex-wrap items-center gap-1 text-[18px] font-medium tracking-tight">
            <button
              type="button"
              onClick={() => setCurrentFolderId(null)}
              className={cn(
                "cursor-pointer rounded-lg px-2 py-0.5 transition-colors",
                activeFolderId === null
                  ? "text-[#f7f8f8]"
                  : "text-[#8a8f98] hover:bg-[#1a1b1f] hover:text-[#f7f8f8]",
              )}
            >
              My Drive
            </button>
            {breadcrumbs.map((crumb, idx) => (
              <div key={crumb.folder_id} className="flex items-center gap-1">
                <ChevronRight className="h-4 w-4 text-[#62666d]" />
                <button
                  type="button"
                  onClick={() => setCurrentFolderId(crumb.folder_id)}
                  className={cn(
                    "max-w-[200px] cursor-pointer truncate rounded-lg px-2 py-0.5 transition-colors",
                    idx === breadcrumbs.length - 1
                      ? "text-[#f7f8f8]"
                      : "text-[#8a8f98] hover:bg-[#1a1b1f] hover:text-[#f7f8f8]",
                  )}
                >
                  {crumb.name}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <h1 className="text-[20px] font-medium tracking-tight text-[#f7f8f8]">
            {query
              ? `Search results for "${search}"`
              : section === "recent"
                ? "Recent"
                : section === "shared"
                  ? "Shared"
                  : "Storage"}
          </h1>
        )}
        <span className="hidden text-[11px] text-[#62666d] lg:inline">
          Press N for folder · U to upload · Right-click or drop files anywhere
        </span>
      </div>

      {section === "storage" && !query && <StorageSummaryCard />}

      {workspaceLoading ? (
        <DashboardSkeleton />
      ) : section === "home" && !query ? (
        <div className="flex flex-1 flex-col gap-6">
          {visibleFolders.length > 0 && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setSuggestedFoldersOpen((v) => !v)}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2 py-1 text-[13px] font-medium text-[#d4d4d8] transition-colors hover:bg-[#1a1b1f]"
              >
                {suggestedFoldersOpen ? (
                  <ChevronDown className="h-4 w-4 text-[#8a8f98]" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-[#8a8f98]" />
                )}
                <span>Suggested folders</span>
              </button>
              {suggestedFoldersOpen && (
                <FolderGrid folders={visibleFolders} compactPill />
              )}
            </div>
          )}

          {visibleDocs.length > 0 && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setSuggestedFilesOpen((v) => !v)}
                className={cn(
                  "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] font-medium transition-colors",
                  suggestedFilesOpen
                    ? "border-transparent text-[#d4d4d8] hover:bg-[#1a1b1f]"
                    : "border-[#7170ff]/60 bg-[#7170ff]/10 text-[#f7f8f8]",
                )}
              >
                {suggestedFilesOpen ? (
                  <ChevronDown className="h-4 w-4 text-[#8a8f98]" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-[#7170ff]" />
                )}
                <span>Suggested files</span>
              </button>
              {suggestedFilesOpen && <FileViews documents={visibleDocs} />}
            </div>
          )}

          {isEmpty && <DashboardEmptyState mode="home" />}
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-7">
          {visibleFolders.length > 0 && (
            <div className="space-y-3">
              <div className="text-xs font-medium text-[#8a8f98]">Folders</div>
              <FolderGrid folders={visibleFolders} />
            </div>
          )}

          {visibleDocs.length > 0 && (
            <div className="space-y-3">
              <div className="text-xs font-medium text-[#8a8f98]">Files</div>
              <FileViews documents={visibleDocs} />
            </div>
          )}

          {isEmpty && <DashboardEmptyState mode="section" />}
        </div>
      )}
    </main>
  );
}
