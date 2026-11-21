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
import type { DocumentListItem, FolderItem } from "@/types";
import type { FolderTreeRow } from "./types";

interface DashboardModalsProps {
  newFolderOpen: boolean;
  newFolderName: string;
  newFolderParentLabel: string;
  creatingFolder: boolean;
  onNewFolderOpenChange: (open: boolean) => void;
  onNewFolderNameChange: (val: string) => void;
  onSubmitNewFolder: () => void;

  renameTarget: FolderItem | null;
  renameValue: string;
  renaming: boolean;
  onCloseRename: () => void;
  onRenameValueChange: (val: string) => void;
  onSubmitRename: () => void;

  moveTarget: DocumentListItem | null;
  movingTargetId: string | null;
  folderTreeRows: FolderTreeRow[];
  onCloseMove: () => void;
  onMoveDoc: (targetFolderId: string | null) => void;
}

export function DashboardModals({
  newFolderOpen,
  newFolderName,
  newFolderParentLabel,
  creatingFolder,
  onNewFolderOpenChange,
  onNewFolderNameChange,
  onSubmitNewFolder,
  renameTarget,
  renameValue,
  renaming,
  onCloseRename,
  onRenameValueChange,
  onSubmitRename,
  moveTarget,
  movingTargetId,
  folderTreeRows,
  onCloseMove,
  onMoveDoc,
}: DashboardModalsProps) {
  return (
    <>
      <Dialog open={newFolderOpen} onOpenChange={onNewFolderOpenChange}>
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
              onSubmitNewFolder();
            }}
          >
            <Input
              autoFocus
              placeholder="e.g. Contracts, Invoices, 2026"
              value={newFolderName}
              onChange={(e) => onNewFolderNameChange(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onNewFolderOpenChange(false)}
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
          if (!open) onCloseRename();
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
              onSubmitRename();
            }}
          >
            <Input
              autoFocus
              value={renameValue}
              onChange={(e) => onRenameValueChange(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onCloseRename}>
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
          if (!open) onCloseMove();
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
              onClick={() => onMoveDoc(null)}
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
                <span className="inline-flex items-center gap-1.5 text-[11px] text-[#7170ff]">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Moving...
                </span>
              ) : (
                !moveTarget?.folder_id && (
                  <span className="text-[10px] text-muted-foreground">
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
                  onClick={() => onMoveDoc(folder.folder_id)}
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
                    <Folder className="h-3.5 w-3.5 shrink-0 text-[#7170ff]" />
                    <span className="truncate">{folder.name}</span>
                  </span>
                  {isMovingHere ? (
                    <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] text-[#7170ff]">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Moving...
                    </span>
                  ) : (
                    isCurrent && (
                      <span className="shrink-0 text-[10px] text-muted-foreground">
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
              onClick={onCloseMove}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
