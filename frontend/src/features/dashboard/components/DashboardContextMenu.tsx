import {
  FileText,
  FolderInput,
  FolderOpen,
  FolderPlus,
  Pencil,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useEditor } from "@/features/editor/context/EditorContext";
import { useWorkspace } from "@/features/workspace/context/WorkspaceContext";
import { useDashboard } from "../context/DashboardContext";

export function DashboardContextMenu() {
  const { refreshWorkspace } = useWorkspace();
  const { session, chooseFile } = useEditor();
  const {
    contextMenu: menu,
    setContextMenu,
    uploadTargetFolderId,
    openNewFolderDialog,
    openFolder,
    setRenameTarget,
    setRenameValue,
    setMoveTarget,
    handleDeleteFolder,
    handleDeleteDoc,
  } = useDashboard();

  if (!menu) return null;
  const close = () => setContextMenu(null);

  return (
    <div
      role="menu"
      data-drive-context-menu="true"
      style={{ left: menu.x, top: menu.y }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      className="fixed z-50 w-52 rounded-xl border border-input bg-secondary p-1.5 text-foreground shadow-menu"
    >
      {menu.kind === "canvas" && (
        <>
          <button
            type="button"
            role="menuitem"
            onClick={() => openNewFolderDialog(uploadTargetFolderId)}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-foreground hover:bg-accent"
          >
            <FolderPlus className="h-3.5 w-3.5 text-brand" />
            <span>New folder</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              close();
              chooseFile(uploadTargetFolderId);
            }}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-foreground hover:bg-accent"
          >
            <Upload className="h-3.5 w-3.5 text-subtle-foreground" />
            <span>Upload file</span>
          </button>
          <Separator className="my-1 bg-border" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              close();
              void refreshWorkspace(true);
            }}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-subtle-foreground hover:bg-accent hover:text-foreground"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Refresh</span>
          </button>
        </>
      )}

      {menu.kind === "folder" && (
        <>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              close();
              openFolder(menu.folder.folder_id);
            }}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-foreground hover:bg-accent"
          >
            <FolderOpen className="h-3.5 w-3.5 text-brand" />
            <span>Open folder</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => openNewFolderDialog(menu.folder.folder_id)}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-strong-foreground hover:bg-accent"
          >
            <FolderPlus className="h-3.5 w-3.5 text-muted-foreground" />
            <span>New folder inside</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              close();
              chooseFile(menu.folder.folder_id);
            }}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-strong-foreground hover:bg-accent"
          >
            <Upload className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Upload file here</span>
          </button>
          <Separator className="my-1 bg-border" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              close();
              setRenameTarget(menu.folder);
              setRenameValue(menu.folder.name);
            }}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-strong-foreground hover:bg-accent"
          >
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Rename</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => void handleDeleteFolder(menu.folder.folder_id)}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Delete folder</span>
          </button>
        </>
      )}

      {menu.kind === "file" && (
        <>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              close();
              void session.loadSavedDocument(menu.doc.doc_id);
            }}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-foreground hover:bg-accent"
          >
            <FileText className="h-3.5 w-3.5 text-brand" />
            <span>Open in editor</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              close();
              setMoveTarget(menu.doc);
            }}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-strong-foreground hover:bg-accent"
          >
            <FolderInput className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Move to folder</span>
          </button>
          <Separator className="my-1 bg-border" />
          <button
            type="button"
            role="menuitem"
            onClick={() => void handleDeleteDoc(menu.doc.doc_id)}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Delete</span>
          </button>
        </>
      )}
    </div>
  );
}
