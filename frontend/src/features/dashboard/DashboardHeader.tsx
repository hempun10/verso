import {
  Keyboard,
  LayoutGrid,
  List,
  LogOut,
  Menu,
  Search,
  User as UserIcon,
  X,
} from "lucide-react";
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

export function DashboardHeader() {
  const { authLoading, isSignedIn, user, setAuthOpen, setShortcutsOpen } =
    useWorkspace();
  const { signOut } = useEditor();
  const {
    search,
    setSearch,
    searchInputRef,
    viewMode,
    setViewMode,
    setMobileNavOpen,
  } = useDashboard();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-4 sm:px-5">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <button
          type="button"
          aria-label="Open menu"
          onClick={() => setMobileNavOpen(true)}
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border text-subtle-foreground hover:bg-accent hover:text-foreground md:hidden"
        >
          <Menu className="h-4 w-4" />
        </button>

        <div className="relative w-full max-w-xl">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-3.5 w-3.5 -translate-y-1/2 text-dim-foreground" />
          <input
            ref={searchInputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search in Drive"
            aria-label="Search in Drive"
            className="h-9 w-full rounded-full border border-border bg-secondary pr-14 pl-9 text-body-sm text-foreground placeholder:text-dim-foreground transition-colors focus:border-brand/70 focus:bg-surface-hover focus:outline-none"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-dim-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded border border-input bg-card px-1.5 py-0.5 font-mono text-2xs text-dim-foreground sm:inline-block">
              ⌘K
            </kbd>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <div
          className="hidden items-center rounded-lg border border-border bg-secondary p-0.5 sm:flex"
          role="group"
          aria-label="Layout view"
        >
          <button
            type="button"
            aria-label="Grid view"
            aria-pressed={viewMode === "grid"}
            onClick={() => setViewMode("grid")}
            className={cn(
              "cursor-pointer rounded-md p-1.5 transition-colors",
              viewMode === "grid"
                ? "bg-surface-active text-foreground"
                : "text-dim-foreground hover:text-subtle-foreground",
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="List view"
            aria-pressed={viewMode === "list"}
            onClick={() => setViewMode("list")}
            className={cn(
              "cursor-pointer rounded-md p-1.5 transition-colors",
              viewMode === "list"
                ? "bg-surface-active text-foreground"
                : "text-dim-foreground hover:text-subtle-foreground",
            )}
          >
            <List className="h-3.5 w-3.5" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShortcutsOpen(true)}
          aria-label="Keyboard shortcuts"
          title="Keyboard shortcuts"
          className="hidden h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:inline-flex"
        >
          <Keyboard className="h-4 w-4" />
        </button>

        {authLoading ? (
          <div
            data-auth-skeleton="true"
            className="h-8 w-20 animate-pulse rounded-full bg-accent"
          />
        ) : isSignedIn && user ? (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Account menu"
                className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-input bg-secondary pr-2.5 pl-1 text-xs font-medium text-foreground transition-colors hover:bg-accent"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-label font-semibold text-background">
                  {(user.name || user.email).slice(0, 1).toUpperCase()}
                </span>
                <span className="hidden max-w-22.5 truncate sm:inline">
                  {user.name}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-56 border-input bg-secondary p-3 text-foreground"
            >
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-foreground">
                  {user.name}
                </div>
                <div className="truncate text-label text-muted-foreground">
                  {user.email}
                </div>
              </div>
              <Separator className="my-2.5 bg-border" />
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => setAuthOpen(true)}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-subtle-foreground hover:bg-accent hover:text-foreground"
                >
                  <UserIcon className="h-3.5 w-3.5" />
                  Switch account
                </button>
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign out
                </button>
              </div>
            </PopoverContent>
          </Popover>
        ) : (
          <button
            type="button"
            onClick={() => setAuthOpen(true)}
            className="inline-flex h-8 cursor-pointer items-center rounded-full border border-input bg-accent px-3.5 text-xs font-semibold text-foreground transition-colors hover:bg-surface-active"
          >
            Sign in
          </button>
        )}
      </div>
    </header>
  );
}
