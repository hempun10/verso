import { FolderPlus, Search, Share2, Upload } from "lucide-react";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";
import { formatFileSize } from "@/lib/validation";
import type { StorageUsage, UploadLimits } from "@/types";
import type { DriveSection } from "./types";

export function StorageSummaryCard({
  usedBytes,
  quotaBytes,
  usedPct,
  progressBarColor,
  storageUsage,
  totalDocsCount,
  uploadLimits,
}: {
  usedBytes: number;
  quotaBytes: number;
  usedPct: number;
  progressBarColor: string;
  storageUsage: StorageUsage | null;
  totalDocsCount: number;
  uploadLimits: UploadLimits;
}) {
  return (
    <div className="mb-6 rounded-xl border border-[#1f2023] bg-[#141516] p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <span className="text-2xl font-semibold text-[#f7f8f8] tabular-nums">
            {formatBytes(usedBytes)}
          </span>{" "}
          <span className="text-sm text-[#8a8f98] tabular-nums">
            of {formatBytes(quotaBytes)} used
          </span>
        </div>
        <div className="text-xs text-[#8a8f98] tabular-nums">
          {storageUsage?.document_count ?? totalDocsCount} files ·{" "}
          {storageUsage?.asset_count ?? 0} saved images &amp; signatures
        </div>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#1f2023]">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            progressBarColor,
          )}
          style={{ width: `${usedBytes > 0 ? Math.max(2, usedPct) : 0}%` }}
        />
      </div>
      <p className="mt-2.5 text-xs text-[#62666d]">
        Max {formatFileSize(uploadLimits.max_pdf_bytes)} per PDF (
        {uploadLimits.max_pdf_pages} pages) · Max{" "}
        {formatFileSize(uploadLimits.max_image_bytes)} per image.
      </p>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div data-dashboard-skeleton="true" className="space-y-6">
      <div className="space-y-3">
        <div className="h-4 w-32 animate-pulse rounded bg-[#141516]" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-xl border border-[#1f2023] bg-[#141516] px-3.5 py-3"
            >
              <div className="h-5 w-5 animate-pulse rounded bg-[#1f2023]" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-24 animate-pulse rounded bg-[#1f2023]" />
                <div className="h-2.5 w-16 animate-pulse rounded bg-[#1a1b1f]" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <div className="h-4 w-28 animate-pulse rounded bg-[#141516]" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="space-y-3 rounded-xl border border-[#1f2023] bg-[#141516] p-3.5"
            >
              <div className="h-24 w-full animate-pulse rounded-lg bg-[#0f1011]" />
              <div className="h-3.5 w-28 animate-pulse rounded bg-[#1f2023]" />
              <div className="h-3 w-20 animate-pulse rounded bg-[#1a1b1f]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface DashboardEmptyStateProps {
  mode: "home" | "section";
  section: DriveSection;
  search: string;
  query: string;
  activeFolderId: string | null;
  activeFolderName: string;
  uploadTargetFolderId: string | null;
  onChooseFile: (folderId: string | null) => void;
  onOpenNewFolder: (parentId: string | null) => void;
}

export function DashboardEmptyState({
  mode,
  section,
  search,
  query,
  activeFolderId,
  activeFolderName,
  uploadTargetFolderId,
  onChooseFile,
  onOpenNewFolder,
}: DashboardEmptyStateProps) {
  const showActions = mode === "home" || (!query && section !== "shared");
  const targetFolder = mode === "home" ? null : uploadTargetFolderId;

  return (
    <div className="my-auto flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#2a2b2f] bg-[#141516]/50 px-6 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#2a2b2f] bg-[#141516] text-[#a1a1aa]">
        {mode === "section" && query ? (
          <Search className="h-5 w-5" />
        ) : mode === "section" && section === "shared" ? (
          <Share2 className="h-5 w-5" />
        ) : (
          <Upload className="h-5 w-5" />
        )}
      </div>
      <h2 className="mt-4 text-sm font-semibold text-[#f7f8f8]">
        {mode === "home"
          ? "Your drive is ready"
          : query
            ? `No matches for "${search}"`
            : section === "shared"
              ? "No shared files yet"
              : activeFolderId
                ? `"${activeFolderName}" is empty`
                : "No files here yet"}
      </h2>
      <p className="mt-1 max-w-xs text-xs leading-relaxed text-[#8a8f98]">
        {mode === "home"
          ? "Drop a PDF or image anywhere on this page, click New, or right-click to create a folder."
          : query
            ? "Try a different file or folder name."
            : section === "shared"
              ? "Open any file and turn on Share to create a shareable edit link."
              : "Drop a PDF or image anywhere on the page or right-click to create a folder."}
      </p>
      {showActions && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
          <button
            type="button"
            onClick={() => onChooseFile(targetFolder)}
            className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg bg-white px-4 text-xs font-semibold text-[#08090a] hover:bg-[#f4f4f6]"
          >
            <Upload className="h-3.5 w-3.5" />
            Upload file
          </button>
          <button
            type="button"
            onClick={() => onOpenNewFolder(targetFolder)}
            className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-[#2a2b2f] bg-[#141516] px-4 text-xs font-medium text-[#d4d4d8] hover:bg-[#1c1d1f]"
          >
            <FolderPlus className="h-3.5 w-3.5 text-[#7170ff]" />
            New folder
          </button>
        </div>
      )}
    </div>
  );
}
