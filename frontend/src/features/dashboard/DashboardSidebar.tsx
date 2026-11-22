import { useState } from "react";
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
import { useEditor } from "@/features/editor/EditorContext";
import { useWorkspace } from "@/features/workspace/WorkspaceContext";
import { cn } from "@/lib/utils";
import { useDashboard } from "./DashboardContext";
import { SidebarFolderTree, SidebarStorageWidget } from "./SidebarFolderTree";

export function DashboardSidebar() {
  const { setCurrentFolderId } = useWorkspace();
  const { goToLanding, chooseFile } = useEditor();
  const {
    section,
    setSection,
    sharedCount,
    mobileNavOpen,
    setMobileNavOpen,
    uploadTargetFolderId,
    openNewFolderDialog,
  } = useDashboard();

  // Colocated UI state owned strictly by the sidebar.
  const [newMenuOpen, setNewMenuOpen] = useState(false);

  return (
    <div className="flex h-full flex-col px-3 py-3.5">
      <div className="flex items-center justify-between px-2 pb-3.5">
        <button
          type="button"
          onClick={goToLanding}
          className="flex cursor-pointer items-center gap-2.5 text-body-md font-semibold tracking-tight text-foreground transition-opacity hover:opacity-85"
        >
          <BrandLogo size={24} />
          <span>{BRAND_NAME}</span>
        </button>
        {mobileNavOpen && (
          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close sidebar"
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="px-1 pb-4">
        <Popover open={newMenuOpen} onOpenChange={setNewMenuOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex h-10 cursor-pointer items-center gap-2.5 rounded-xl bg-white pr-5 pl-3.5 text-body-sm font-semibold text-background shadow-cta-lg transition-[transform,background-color] duration-100 hover:bg-cta-hover active:scale-98"
            >
              <Plus className="h-4 w-4 stroke-[2.4]" />
              <span>New</span>
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            sideOffset={6}
            className="w-52 border-input bg-secondary p-1.5 text-foreground shadow-2xl"
          >
            <button
              type="button"
              onClick={() => {
                setNewMenuOpen(false);
                openNewFolderDialog(uploadTargetFolderId);
              }}
              className="flex w-full cursor-pointer items-center justify-between gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-foreground transition-colors hover:bg-accent"
            >
              <span className="flex items-center gap-2.5">
                <FolderPlus className="h-4 w-4 text-brand" />
                <span>New folder</span>
              </span>
              <kbd className="rounded border border-input bg-card px-1.5 py-0.5 font-mono text-2xs text-dim-foreground">
                N
              </kbd>
            </button>
            <Separator className="my-1 bg-border" />
            <button
              type="button"
              onClick={() => {
                setNewMenuOpen(false);
                setMobileNavOpen(false);
                chooseFile(uploadTargetFolderId);
              }}
              className="flex w-full cursor-pointer items-center justify-between gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-foreground transition-colors hover:bg-accent"
            >
              <span className="flex items-center gap-2.5">
                <Upload className="h-4 w-4 text-subtle-foreground" />
                <span>File upload</span>
              </span>
              <kbd className="rounded border border-input bg-card px-1.5 py-0.5 font-mono text-2xs text-dim-foreground">
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
            setSection("home");
            setCurrentFolderId(null);
            setMobileNavOpen(false);
          }}
          className={cn(
            "flex cursor-pointer items-center gap-2.5 rounded-full px-3 py-2 text-body-sm font-medium transition-colors",
            section === "home"
              ? "bg-brand/18 text-foreground"
              : "text-subtle-foreground hover:bg-surface-hover hover:text-foreground",
          )}
        >
          <Home
            className={cn(
              "h-4 w-4 shrink-0",
              section === "home" ? "text-brand" : "text-muted-foreground",
            )}
          />
          <span>Home</span>
        </button>

        <SidebarFolderTree />

        <Separator className="my-2.5 bg-border" />

        <button
          type="button"
          onClick={() => {
            setSection("shared");
            setMobileNavOpen(false);
          }}
          className={cn(
            "flex cursor-pointer items-center justify-between rounded-full px-3 py-2 text-body-sm font-medium transition-colors",
            section === "shared"
              ? "bg-brand/18 text-foreground"
              : "text-subtle-foreground hover:bg-surface-hover hover:text-foreground",
          )}
        >
          <span className="flex items-center gap-2.5">
            <Share2
              className={cn(
                "h-4 w-4 shrink-0",
                section === "shared" ? "text-brand" : "text-muted-foreground",
              )}
            />
            <span>Shared</span>
          </span>
          {sharedCount > 0 && (
            <span className="text-label text-dim-foreground tabular-nums">
              {sharedCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setSection("recent");
            setMobileNavOpen(false);
          }}
          className={cn(
            "flex cursor-pointer items-center gap-2.5 rounded-full px-3 py-2 text-body-sm font-medium transition-colors",
            section === "recent"
              ? "bg-brand/18 text-foreground"
              : "text-subtle-foreground hover:bg-surface-hover hover:text-foreground",
          )}
        >
          <Clock
            className={cn(
              "h-4 w-4 shrink-0",
              section === "recent" ? "text-brand" : "text-muted-foreground",
            )}
          />
          <span>Recent</span>
        </button>

        <Separator className="my-2.5 bg-border" />

        <button
          type="button"
          onClick={() => {
            setSection("storage");
            setMobileNavOpen(false);
          }}
          className={cn(
            "flex cursor-pointer items-center gap-2.5 rounded-full px-3 py-2 text-body-sm font-medium transition-colors",
            section === "storage"
              ? "bg-brand/18 text-foreground"
              : "text-subtle-foreground hover:bg-surface-hover hover:text-foreground",
          )}
        >
          <Cloud
            className={cn(
              "h-4 w-4 shrink-0",
              section === "storage" ? "text-brand" : "text-muted-foreground",
            )}
          />
          <span>Storage</span>
        </button>

        <SidebarStorageWidget />
      </nav>
    </div>
  );
}
