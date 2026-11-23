import { LogIn, LogOut, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspace } from "@/features/workspace/context/WorkspaceContext";
import { useEditor } from "../context/EditorContext";

export function EditorAccountMenu() {
  const { authLoading, isSignedIn, user, setAuthOpen } = useWorkspace();
  const { signOut } = useEditor();

  if (authLoading) {
    return (
      <Skeleton data-auth-skeleton="true" className="h-8 w-20 rounded-full" />
    );
  }

  if (isSignedIn && user) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            aria-label="Account menu"
            className="h-8 gap-1.5 rounded-full pr-2.5 pl-1.5"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-2xs font-semibold text-primary-foreground">
              {(user.name || user.email).slice(0, 1).toUpperCase()}
            </span>
            <span className="hidden max-w-20 truncate text-xs font-medium xl:inline">
              {user.name}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-56 p-3">
          <div className="space-y-0.5">
            <div className="text-xs font-semibold text-foreground">
              {user.name}
            </div>
            <div className="truncate text-label text-muted-foreground">
              {user.email}
            </div>
          </div>
          <Separator className="my-2.5" />
          <div className="flex flex-col gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="justify-start"
              onClick={() => setAuthOpen(true)}
            >
              <UserIcon className="h-3.5 w-3.5" />
              Switch account
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="justify-start text-destructive hover:bg-destructive/15 hover:text-destructive"
              onClick={() => void signOut()}
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Button
      variant="outline"
      size="default"
      aria-label="Sign in"
      onClick={() => setAuthOpen(true)}
    >
      <LogIn className="h-3.5 w-3.5" />
      <span>Sign in</span>
    </Button>
  );
}
