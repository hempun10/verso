import type React from "react";
import {
  Clock,
  Cloud,
  FolderPlus,
  Home,
  Plus,
  Share2,
  Upload,
  X,
} from "lucide-react";
import { BRAND_NAME, BrandLogo } from "@/components/BrandLogo";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { SidebarFolderTree, SidebarStorageWidget } from "./SidebarFolderTree";
import type {
  ContextMenuTarget,
  DriveSection,
  FolderCounts,
  FolderTreeRow,
} from "./types";

interface DashboardSidebarProps {
  section: DriveSection;
  activeFolderId: string | null;
  documentCount: number;
  sharedCount: number;
  folderTreeRows: FolderTreeRow[];
  folderCounts: Map<string, FolderCounts>;
  driveTreeExpanded: boolean;
  newMenuOpen: boolean;
  mobileNavOpen: boolean;
  uploadTargetFolderId: string | null;
  usedBytes: number;
  quotaBytes: number;
  usedPct: number;
  progressBarColor: string;
  onGoHome: () => void;
  onSetSection: (section: DriveSection) => void;
  onSelectFolder: (folderId: string | null) => void;
  onToggleDriveTree: () => void;
  onSetNewMenuOpen: (open: boolean) => void;
  onCloseMobileNav: () => void;
  onOpenNewFolder: (parentId: string | null) => void;
  onChooseFile: (folderId: string | null) => void;
  onOpenContextMenu: (e: React.MouseEvent, target: ContextMenuTarget) => void;
}

export function DashboardSidebar({
  section,
  activeFolderId,
  documentCount,
  sharedCount,
  folderTreeRows,
  folderCounts,
  driveTreeExpanded,
  newMenuOpen,
  mobileNavOpen,
  uploadTargetFolderId,
  usedBytes,
  quotaBytes,
  usedPct,
  progressBarColor,
  onGoHome,
  onSetSection,
  onSelectFolder,
  onToggleDriveTree,
  onSetNewMenuOpen,
  onCloseMobileNav,
  onOpenNewFolder,
  onChooseFile,
  onOpenContextMenu,
}: DashboardSidebarProps) {
  return (
    <div className="flex h-full flex-col px-3 py-3.5">
      <div className="flex items-center justify-between px-2 pb-3.5">
        <button
          type="button"
          onClick={onGoHome}
          className="flex cursor-pointer items-center gap-2.5 text-[15px] font-semibold tracking-[-0.01em] text-[#f7f8f8] transition-opacity hover:opacity-85"
        >
          <BrandLogo size={24} />
          <span>{BRAND_NAME}</span>
        </button>
        {mobileNavOpen && (
          <button
            type="button"
            onClick={onCloseMobileNav}
            aria-label="Close sidebar"
            className="rounded-md p-1 text-[#8a8f98] hover:bg-[#1c1d1f] hover:text-[#f7f8f8] md:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="px-1 pb-4">
        <Popover open={newMenuOpen} onOpenChange={onSetNewMenuOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex h-10 cursor-pointer items-center gap-2.5 rounded-xl bg-white pr-5 pl-3.5 text-[13px] font-semibold text-[#08090a] shadow-[inset_0_-1px_0_rgba(0,0,0,0.14),0_2px_8px_rgba(0,0,0,0.45)] transition-[transform,background-color] duration-100 hover:bg-[#f4f4f6] active:scale-[0.98]"
            >
              <Plus className="h-4 w-4 stroke-[2.4]" />
              <span>New</span>
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            sideOffset={6}
            className="w-52 border-[#2a2b2f] bg-[#141516] p-1.5 text-[#f7f8f8] shadow-2xl"
          >
            <button
              type="button"
              onClick={() => onOpenNewFolder(uploadTargetFolderId)}
              className="flex w-full cursor-pointer items-center justify-between gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-[#f7f8f8] transition-colors hover:bg-[#1c1d1f]"
            >
              <span className="flex items-center gap-2.5">
                <FolderPlus className="h-4 w-4 text-[#7170ff]" />
                <span>New folder</span>
              </span>
              <kbd className="rounded border border-[#2a2b2f] bg-[#0f1011] px-1.5 py-0.5 font-mono text-[10px] text-[#62666d]">
                N
              </kbd>
            </button>
            <Separator className="my-1 bg-[#1f2023]" />
            <button
              type="button"
              onClick={() => {
                onSetNewMenuOpen(false);
                onCloseMobileNav();
                onChooseFile(uploadTargetFolderId);
              }}
              className="flex w-full cursor-pointer items-center justify-between gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-[#f7f8f8] transition-colors hover:bg-[#1c1d1f]"
            >
              <span className="flex items-center gap-2.5">
                <Upload className="h-4 w-4 text-[#a1a1aa]" />
                <span>File upload</span>
              </span>
              <kbd className="rounded border border-[#2a2b2f] bg-[#0f1011] px-1.5 py-0.5 font-mono text-[10px] text-[#62666d]">
                U
              </kbd>
            </button>
          </PopoverContent>
        </Popover>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto pr-0.5 [scrollbar-width:none]">
        <button
          type="button"
          onClick={() => {
            onSetSection("home");
            onSelectFolder(null);
            onCloseMobileNav();
          }}
          className={cn(
            "flex cursor-pointer items-center gap-2.5 rounded-full px-3 py-2 text-[13px] font-medium transition-colors",
            section === "home"
              ? "bg-[#7170ff]/18 text-[#f7f8f8]"
              : "text-[#a1a1aa] hover:bg-[#16171a] hover:text-[#f7f8f8]",
          )}
        >
          <Home
            className={cn(
              "h-4 w-4 shrink-0",
              section === "home" ? "text-[#7170ff]" : "text-[#8a8f98]",
            )}
          />
          <span>Home</span>
        </button>

        <SidebarFolderTree
          section={section}
          activeFolderId={activeFolderId}
          documentCount={documentCount}
          folderTreeRows={folderTreeRows}
          folderCounts={folderCounts}
          driveTreeExpanded={driveTreeExpanded}
          onToggleDriveTree={onToggleDriveTree}
          onSelectRoot={() => {
            onSetSection("drive");
            onSelectFolder(null);
            onCloseMobileNav();
          }}
          onSelectFolder={(id) => {
            onSetSection("drive");
            onSelectFolder(id);
            onCloseMobileNav();
          }}
          onOpenContextMenu={onOpenContextMenu}
        />

        <Separator className="my-2.5 bg-[#1a1b1e]" />

        <button
          type="button"
          onClick={() => {
            onSetSection("shared");
            onCloseMobileNav();
          }}
          className={cn(
            "flex cursor-pointer items-center justify-between rounded-full px-3 py-2 text-[13px] font-medium transition-colors",
            section === "shared"
              ? "bg-[#7170ff]/18 text-[#f7f8f8]"
              : "text-[#a1a1aa] hover:bg-[#16171a] hover:text-[#f7f8f8]",
          )}
        >
          <span className="flex items-center gap-2.5">
            <Share2
              className={cn(
                "h-4 w-4 shrink-0",
                section === "shared" ? "text-[#7170ff]" : "text-[#8a8f98]",
              )}
            />
            <span>Shared</span>
          </span>
          {sharedCount > 0 && (
            <span className="text-[11px] text-[#62666d] tabular-nums">
              {sharedCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            onSetSection("recent");
            onCloseMobileNav();
          }}
          className={cn(
            "flex cursor-pointer items-center gap-2.5 rounded-full px-3 py-2 text-[13px] font-medium transition-colors",
            section === "recent"
              ? "bg-[#7170ff]/18 text-[#f7f8f8]"
              : "text-[#a1a1aa] hover:bg-[#16171a] hover:text-[#f7f8f8]",
          )}
        >
          <Clock
            className={cn(
              "h-4 w-4 shrink-0",
              section === "recent" ? "text-[#7170ff]" : "text-[#8a8f98]",
            )}
          />
          <span>Recent</span>
        </button>

        <Separator className="my-2.5 bg-[#1a1b1e]" />

        <button
          type="button"
          onClick={() => {
            onSetSection("storage");
            onCloseMobileNav();
          }}
          className={cn(
            "flex cursor-pointer items-center gap-2.5 rounded-full px-3 py-2 text-[13px] font-medium transition-colors",
            section === "storage"
              ? "bg-[#7170ff]/18 text-[#f7f8f8]"
              : "text-[#a1a1aa] hover:bg-[#16171a] hover:text-[#f7f8f8]",
          )}
        >
          <Cloud
            className={cn(
              "h-4 w-4 shrink-0",
              section === "storage" ? "text-[#7170ff]" : "text-[#8a8f98]",
            )}
          />
          <span>Storage</span>
        </button>

        <SidebarStorageWidget
          usedBytes={usedBytes}
          quotaBytes={quotaBytes}
          usedPct={usedPct}
          progressBarColor={progressBarColor}
          onManageStorage={() => {
            onSetSection("storage");
            onCloseMobileNav();
          }}
        />
      </nav>
    </div>
  );
}
