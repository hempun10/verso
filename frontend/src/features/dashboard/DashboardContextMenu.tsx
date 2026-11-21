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
import { useEditor } from "@/features/editor/EditorContext";
import { useWorkspace } from "@/features/workspace/WorkspaceContext";
import { useDashboard } from "./DashboardContext";

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
      className="fixed z-50 w-52 rounded-xl border border-[#2a2b2f] bg-[#141516] p-1.5 text-[#f7f8f8] shadow-[0_18px_48px_-12px_rgba(0,0,0,0.85)]"
    >
      {menu.kind === "canvas" && (
        <>
          <button
            type="button"
            role="menuitem"
            onClick={() => openNewFolderDialog(uploadTargetFolderId)}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-[#f7f8f8] hover:bg-[#1c1d1f]"
          >
            <FolderPlus className="h-3.5 w-3.5 text-[#7170ff]" />
            <span>New folder</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              close();
              chooseFile(uploadTargetFolderId);
            }}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-[#f7f8f8] hover:bg-[#1c1d1f]"
          >
            <Upload className="h-3.5 w-3.5 text-[#a1a1aa]" />
            <span>Upload file</span>
          </button>
          <Separator className="my-1 bg-[#1f2023]" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              close();
              void refreshWorkspace(true);
            }}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-[#a1a1aa] hover:bg-[#1c1d1f] hover:text-[#f7f8f8]"
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
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-[#f7f8f8] hover:bg-[#1c1d1f]"
          >
            <FolderOpen className="h-3.5 w-3.5 text-[#7170ff]" />
            <span>Open folder</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => openNewFolderDialog(menu.folder.folder_id)}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-[#d4d4d8] hover:bg-[#1c1d1f]"
          >
            <FolderPlus className="h-3.5 w-3.5 text-[#8a8f98]" />
            <span>New folder inside</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              close();
              chooseFile(menu.folder.folder_id);
            }}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-[#d4d4d8] hover:bg-[#1c1d1f]"
          >
            <Upload className="h-3.5 w-3.5 text-[#8a8f98]" />
            <span>Upload file here</span>
          </button>
          <Separator className="my-1 bg-[#1f2023]" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              close();
              setRenameTarget(menu.folder);
              setRenameValue(menu.folder.name);
            }}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-[#d4d4d8] hover:bg-[#1c1d1f]"
          >
            <Pencil className="h-3.5 w-3.5 text-[#8a8f98]" />
            <span>Rename</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => void handleDeleteFolder(menu.folder.folder_id)}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-[#e0705f] hover:bg-[#e0705f]/10"
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
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-[#f7f8f8] hover:bg-[#1c1d1f]"
          >
            <FileText className="h-3.5 w-3.5 text-[#7170ff]" />
            <span>Open in editor</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              close();
              setMoveTarget(menu.doc);
            }}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-[#d4d4d8] hover:bg-[#1c1d1f]"
          >
            <FolderInput className="h-3.5 w-3.5 text-[#8a8f98]" />
            <span>Move to folder</span>
          </button>
          <Separator className="my-1 bg-[#1f2023]" />
          <button
            type="button"
            role="menuitem"
            onClick={() => void handleDeleteDoc(menu.doc.doc_id)}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-[#e0705f] hover:bg-[#e0705f]/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Delete</span>
          </button>
        </>
      )}
    </div>
  );
}
