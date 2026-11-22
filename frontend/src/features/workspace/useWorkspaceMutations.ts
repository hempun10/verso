import type { Dispatch, SetStateAction } from "react";
import {
  createFolder,
  deleteAsset,
  deleteDocument,
  deleteFolder,
  fetchStorageUsage,
  moveDocumentToFolder,
  updateFolder,
} from "@/api";
import type {
  AssetItem,
  DocumentListItem,
  FolderItem,
  StorageUsage,
} from "@/types";

interface UseWorkspaceMutationsArgs {
  folders: FolderItem[];
  currentFolderId: string | null;
  setFolders: Dispatch<SetStateAction<FolderItem[]>>;
  setSavedDocs: Dispatch<SetStateAction<DocumentListItem[]>>;
  setAssets: Dispatch<SetStateAction<AssetItem[]>>;
  setStorageUsage: Dispatch<SetStateAction<StorageUsage | null>>;
  setCurrentFolderId: Dispatch<SetStateAction<string | null>>;
  setError: (msg: string | null) => void;
}

export function useWorkspaceMutations({
  folders,
  currentFolderId,
  setFolders,
  setSavedDocs,
  setAssets,
  setStorageUsage,
  setCurrentFolderId,
  setError,
}: UseWorkspaceMutationsArgs) {
  const handleCreateFolder = async (name: string, parentId: string | null) => {
    setError(null);
    try {
      const created = await createFolder(name, parentId);
      setFolders((prev) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name)),
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create folder.");
    }
  };

  const handleRenameFolder = async (folderId: string, name: string) => {
    setError(null);
    try {
      const updated = await updateFolder(folderId, { name });
      setFolders((prev) =>
        prev
          .map((f) => (f.folder_id === folderId ? updated : f))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to rename folder.");
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    setError(null);
    try {
      const fallbackParent =
        folders.find((f) => f.folder_id === folderId)?.parent_id ?? null;
      await deleteFolder(folderId);
      setFolders((prev) =>
        prev
          .filter((f) => f.folder_id !== folderId)
          .map((f) =>
            f.parent_id === folderId ? { ...f, parent_id: fallbackParent } : f,
          ),
      );
      setSavedDocs((prev) =>
        prev.map((d) =>
          d.folder_id === folderId ? { ...d, folder_id: fallbackParent } : d,
        ),
      );
      if (currentFolderId === folderId) setCurrentFolderId(fallbackParent);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete folder.");
    }
  };

  const handleMoveDocToFolder = async (
    docId: string,
    folderId: string | null,
  ) => {
    setError(null);
    try {
      await moveDocumentToFolder(docId, folderId);
      setSavedDocs((prev) =>
        prev.map((d) =>
          d.doc_id === docId ? { ...d, folder_id: folderId } : d,
        ),
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to move document.");
    }
  };

  const handleDeleteSavedDoc = async (docId: string) => {
    await deleteDocument(docId);
    setSavedDocs((prev) => prev.filter((d) => d.doc_id !== docId));
    void fetchStorageUsage()
      .then(setStorageUsage)
      .catch(() => {});
  };

  const handleDeleteAsset = async (assetId: string) => {
    await deleteAsset(assetId);
    setAssets((prev) => prev.filter((a) => a.asset_id !== assetId));
  };

  return {
    handleCreateFolder,
    handleRenameFolder,
    handleDeleteFolder,
    handleMoveDocToFolder,
    handleDeleteSavedDoc,
    handleDeleteAsset,
  };
}
