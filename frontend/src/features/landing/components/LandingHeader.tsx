import { useState } from "react";
import { FileText, LogOut, Menu, User as UserIcon, X } from "lucide-react";
import { BRAND_NAME, BrandLogo } from "@/components/BrandLogo";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { useEditor } from "@/features/editor/context/EditorContext";
import { useWorkspace } from "@/features/workspace/context/WorkspaceContext";
import { useScrolled } from "@/hooks/useScrolled";
import { cn } from "@/lib/utils";
import { PrimaryCtaButton, SecondaryButton } from "./primitives";

const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#faq", label: "FAQ" },
];

export function LandingHeader() {
  const { authLoading, isSignedIn, user, setAuthOpen } = useWorkspace();
  const { openDashboard, signOut } = useEditor();
  const scrolled = useScrolled(12);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <header
      className={cn(
        "sticky z-50 mx-3 flex justify-center transition-all duration-300 md:mx-0",
        scrolled ? "top-4" : "top-3",
      )}
    >
      <div
        className={cn(
          "w-full transition-all duration-300",
          scrolled ? "max-w-205" : "max-w-7xl",
        )}
      >
        <div
          className={cn(
            "mx-auto rounded-2xl transition-all duration-300",
            scrolled
              ? "border border-border bg-background/80 px-2 backdrop-blur-lg"
              : "px-4 md:px-10",
          )}
        >
          <div className="flex h-14 items-center justify-between px-2">
            <a
              href="#hero"
              className="flex items-center gap-2.5 text-body-md font-semibold tracking-tight text-foreground"
            >
              <BrandLogo size={24} />
              <span>{BRAND_NAME}</span>
            </a>

            <nav className="hidden items-center gap-1 md:flex">
              {NAV_LINKS.map((n) => (
                <a
                  key={n.label}
                  href={n.href}
                  className="rounded-full px-3 py-1.5 text-sm text-subtle-foreground transition-colors hover:bg-accent/70 hover:text-foreground"
                >
                  {n.label}
                </a>
              ))}
            </nav>

            <div className="flex items-center gap-2.5">
              {authLoading ? (
                <div
                  data-auth-skeleton="true"
                  className="h-7.5 w-28 animate-pulse rounded-lg bg-accent"
                />
              ) : isSignedIn && user ? (
                <>
                  <SecondaryButton
                    size="sm"
                    onClick={openDashboard}
                    className="hidden sm:inline-flex"
                  >
                    Open dashboard
                  </SecondaryButton>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        aria-label="Account menu"
                        className="inline-flex h-7.5 w-7.5 cursor-pointer items-center justify-center rounded-lg border border-input bg-secondary text-label font-semibold text-foreground transition-colors hover:bg-accent"
                      >
                        {(user.name || user.email).slice(0, 1).toUpperCase()}
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
                          onClick={openDashboard}
                          className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-subtle-foreground transition-colors hover:bg-accent hover:text-foreground"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          Open dashboard
                        </button>
                        <button
                          type="button"
                          onClick={() => setAuthOpen(true)}
                          className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-subtle-foreground transition-colors hover:bg-accent hover:text-foreground"
                        >
                          <UserIcon className="h-3.5 w-3.5" />
                          Switch account
                        </button>
                        <button
                          type="button"
                          onClick={() => void signOut()}
                          className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-destructive transition-colors hover:bg-destructive/10"
                        >
                          <LogOut className="h-3.5 w-3.5" />
                          Sign out
                        </button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </>
              ) : (
                <SecondaryButton
                  size="sm"
                  onClick={() => setAuthOpen(true)}
                  className="hidden sm:inline-flex"
                >
                  Sign in
                </SecondaryButton>
              )}

              <button
                type="button"
                onClick={() => setDrawerOpen((o) => !o)}
                aria-label="Menu"
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-border text-foreground md:hidden"
              >
                {drawerOpen ? (
                  <X className="h-4 w-4" />
                ) : (
                  <Menu className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {drawerOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="fixed inset-x-3 bottom-3 z-50 rounded-xl border border-border bg-card p-4 shadow-2xl md:hidden">
            <div className="flex items-center justify-between pb-3">
              <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <BrandLogo size={24} />
                {BRAND_NAME}
              </span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="rounded-md border border-border p-1 text-subtle-foreground"
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="mb-3 flex flex-col divide-y divide-border rounded-lg border border-border text-sm">
              {NAV_LINKS.map((n) => (
                <li key={n.label}>
                  <a
                    href={n.href}
                    onClick={() => setDrawerOpen(false)}
                    className="block px-3 py-2.5 text-subtle-foreground hover:text-foreground"
                  >
                    {n.label}
                  </a>
                </li>
              ))}
            </ul>
            {isSignedIn ? (
              <PrimaryCtaButton
                full
                onClick={() => {
                  setDrawerOpen(false);
                  openDashboard();
                }}
              >
                Open dashboard
              </PrimaryCtaButton>
            ) : (
              <PrimaryCtaButton
                full
                onClick={() => {
                  setDrawerOpen(false);
                  setAuthOpen(true);
                }}
              >
                Sign in
              </PrimaryCtaButton>
            )}
          </div>
        </>
      )}
    </header>
  );
}
