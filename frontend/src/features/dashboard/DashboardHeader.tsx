import type { RefObject } from "react";
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
import { cn } from "@/lib/utils";
import type { UserInfo } from "@/types";
import type { ViewMode } from "./types";

interface DashboardHeaderProps {
  search: string;
  searchInputRef: RefObject<HTMLInputElement | null>;
  viewMode: ViewMode;
  authLoading: boolean;
  isSignedIn: boolean;
  user: UserInfo | null;
  onSearchChange: (value: string) => void;
  onViewModeChange: (mode: ViewMode) => void;
  onOpenMobileNav: () => void;
  onOpenShortcuts: () => void;
  onOpenAuth: () => void;
  onSignOut: () => void;
}

export function DashboardHeader({
  search,
  searchInputRef,
  viewMode,
  authLoading,
  isSignedIn,
  user,
  onSearchChange,
  onViewModeChange,
  onOpenMobileNav,
  onOpenShortcuts,
  onOpenAuth,
  onSignOut,
}: DashboardHeaderProps) {
  return (
    <header className="flex h-[56px] shrink-0 items-center justify-between gap-3 border-b border-[#1f2023] px-4 sm:px-5">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <button
          type="button"
          aria-label="Open menu"
          onClick={onOpenMobileNav}
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-[#1f2023] text-[#a1a1aa] hover:bg-[#1c1d1f] hover:text-[#f7f8f8] md:hidden"
        >
          <Menu className="h-4 w-4" />
        </button>

        <div className="relative w-full max-w-xl">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-3.5 w-3.5 -translate-y-1/2 text-[#62666d]" />
          <input
            ref={searchInputRef}
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search in Drive"
            aria-label="Search in Drive"
            className="h-9 w-full rounded-full border border-[#1f2023] bg-[#141516] pr-14 pl-9 text-[13px] text-[#f7f8f8] placeholder:text-[#62666d] transition-colors focus:border-[#7170ff]/70 focus:bg-[#18191d] focus:outline-none"
          />
          {search ? (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              aria-label="Clear search"
              className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-[#62666d] hover:text-[#f7f8f8]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded border border-[#2a2b2f] bg-[#0f1011] px-1.5 py-0.5 font-mono text-[10px] text-[#62666d] sm:inline-block">
              ⌘K
            </kbd>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <div
          className="hidden items-center rounded-lg border border-[#1f2023] bg-[#141516] p-0.5 sm:flex"
          role="group"
          aria-label="Layout view"
        >
          <button
            type="button"
            aria-label="Grid view"
            aria-pressed={viewMode === "grid"}
            onClick={() => onViewModeChange("grid")}
            className={cn(
              "cursor-pointer rounded-md p-1.5 transition-colors",
              viewMode === "grid"
                ? "bg-[#232428] text-[#f7f8f8]"
                : "text-[#62666d] hover:text-[#a1a1aa]",
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="List view"
            aria-pressed={viewMode === "list"}
            onClick={() => onViewModeChange("list")}
            className={cn(
              "cursor-pointer rounded-md p-1.5 transition-colors",
              viewMode === "list"
                ? "bg-[#232428] text-[#f7f8f8]"
                : "text-[#62666d] hover:text-[#a1a1aa]",
            )}
          >
            <List className="h-3.5 w-3.5" />
          </button>
        </div>

        <button
          type="button"
          onClick={onOpenShortcuts}
          aria-label="Keyboard shortcuts"
          title="Keyboard shortcuts"
          className="hidden h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[#8a8f98] transition-colors hover:bg-[#1c1d1f] hover:text-[#f7f8f8] sm:inline-flex"
        >
          <Keyboard className="h-4 w-4" />
        </button>

        {authLoading ? (
          <div
            data-auth-skeleton="true"
            className="h-8 w-20 animate-pulse rounded-full bg-[#1c1d1f]"
          />
        ) : isSignedIn && user ? (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Account menu"
                className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-[#2a2b2f] bg-[#141516] pr-2.5 pl-1 text-xs font-medium text-[#f7f8f8] transition-colors hover:bg-[#1c1d1f]"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-[11px] font-semibold text-[#08090a]">
                  {(user.name || user.email).slice(0, 1).toUpperCase()}
                </span>
                <span className="hidden max-w-[90px] truncate sm:inline">
                  {user.name}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-56 border-[#2a2b2f] bg-[#141516] p-3 text-[#f7f8f8]"
            >
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-[#f7f8f8]">
                  {user.name}
                </div>
                <div className="truncate text-[11px] text-[#8a8f98]">
                  {user.email}
                </div>
              </div>
              <Separator className="my-2.5 bg-[#1f2023]" />
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-[#a1a1aa] hover:bg-[#1c1d1f] hover:text-[#f7f8f8]"
                >
                  <UserIcon className="h-3.5 w-3.5" />
                  Switch account
                </button>
                <button
                  type="button"
                  onClick={onSignOut}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-[#e0705f] hover:bg-[#e0705f]/10"
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
            onClick={onOpenAuth}
            className="inline-flex h-8 cursor-pointer items-center rounded-full border border-[#2a2b2f] bg-[#1c1d1f] px-3.5 text-xs font-semibold text-[#f7f8f8] transition-colors hover:bg-[#25262b]"
          >
            Sign in
          </button>
        )}
      </div>
    </header>
  );
}
