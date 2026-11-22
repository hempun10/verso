import { Folder, HardDrive, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useDashboard } from "./DashboardContext";

export function DashboardModals() {
  const {
    newFolderOpen,
    setNewFolderOpen,
    newFolderName,
    setNewFolderName,
    newFolderParentLabel,
    creatingFolder,
    submitNewFolder,
    renameTarget,
    setRenameTarget,
    renameValue,
    setRenameValue,
    renaming,
    submitRenameFolder,
    moveTarget,
    setMoveTarget,
    movingTargetId,
    folderTreeRows,
    handleMoveDoc,
  } = useDashboard();

  return (
    <>
      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New folder</DialogTitle>
            <DialogDescription>
              Create a folder inside{" "}
              <span className="font-medium text-foreground">
                {newFolderParentLabel}
              </span>
              .
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void submitNewFolder();
            }}
          >
            <Input
              autoFocus
              placeholder="e.g. Contracts, Invoices, 2026"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setNewFolderOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!newFolderName.trim() || creatingFolder}
              >
                {creatingFolder ? "Creating..." : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(renameTarget)}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename folder</DialogTitle>
            <DialogDescription>
              Choose a new name for this folder.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void submitRenameFolder();
            }}
          >
            <Input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRenameTarget(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!renameValue.trim() || renaming}>
                {renaming ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(moveTarget)}
        onOpenChange={(open) => {
          if (!open) setMoveTarget(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Move file</DialogTitle>
            <DialogDescription>
              Choose a destination folder for{" "}
              <span className="font-medium text-foreground">
                {moveTarget?.filename}
              </span>
              .
            </DialogDescription>
          </DialogHeader>
          <div className="flex max-h-64 flex-col gap-1 overflow-y-auto py-1">
            <button
              type="button"
              disabled={movingTargetId !== null}
              onClick={() => void handleMoveDoc(null)}
              className={cn(
                "flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60",
                movingTargetId === "__root__"
                  ? "border-ring/60 bg-ring/12"
                  : !moveTarget?.folder_id
                    ? "border-input bg-secondary"
                    : "border-transparent",
              )}
            >
              <span className="flex items-center gap-2">
                <HardDrive className="h-3.5 w-3.5 text-muted-foreground" />
                My Drive (Root)
              </span>
              {movingTargetId === "__root__" ? (
                <span className="inline-flex items-center gap-1.5 text-label text-brand">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Moving...
                </span>
              ) : (
                !moveTarget?.folder_id && (
                  <span className="text-2xs text-muted-foreground">
                    Current
                  </span>
                )
              )}
            </button>
            {folderTreeRows.map(({ folder, depth }) => {
              const isCurrent = moveTarget?.folder_id === folder.folder_id;
              const isMovingHere = movingTargetId === folder.folder_id;
              return (
                <button
                  key={folder.folder_id}
                  type="button"
                  disabled={movingTargetId !== null}
                  onClick={() => void handleMoveDoc(folder.folder_id)}
                  style={{ paddingLeft: `${12 + depth * 16}px` }}
                  className={cn(
                    "flex cursor-pointer items-center justify-between rounded-lg border py-2 pr-3 text-left text-xs font-medium transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60",
                    isMovingHere
                      ? "border-ring/60 bg-ring/12"
                      : isCurrent
                        ? "border-input bg-secondary"
                        : "border-transparent",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Folder className="h-3.5 w-3.5 shrink-0 text-brand" />
                    <span className="truncate">{folder.name}</span>
                  </span>
                  {isMovingHere ? (
                    <span className="inline-flex shrink-0 items-center gap-1.5 text-label text-brand">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Moving...
                    </span>
                  ) : (
                    isCurrent && (
                      <span className="shrink-0 text-2xs text-muted-foreground">
                        Current
                      </span>
                    )
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex justify-end">
            <Button
              variant="outline"
              disabled={movingTargetId !== null}
              onClick={() => setMoveTarget(null)}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
