import type { Dispatch, SetStateAction } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createFolder,
  deleteAsset,
  deleteDocument,
  deleteFolder,
  moveDocumentToFolder,
  updateFolder,
} from "@/api";
import { queryKeys } from "@/lib/queryClient";
import type { AssetItem, DocumentListItem, FolderItem } from "@/types";

interface UseWorkspaceMutationsArgs {
  folders: FolderItem[];
  currentFolderId: string | null;
  setCurrentFolderId: Dispatch<SetStateAction<string | null>>;
  setError: (msg: string | null) => void;
}

export function useWorkspaceMutations({
  folders,
  currentFolderId,
  setCurrentFolderId,
  setError,
}: UseWorkspaceMutationsArgs) {
  const queryClient = useQueryClient();

  const createFolderMut = useMutation({
    mutationFn: ({ name, parentId }: { name: string; parentId: string | null }) =>
      createFolder(name, parentId),
    onSuccess: (created) => {
      queryClient.setQueryData<FolderItem[]>(queryKeys.folders, (prev = []) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name)),
      );
    },
  });

  const renameFolderMut = useMutation({
    mutationFn: ({ folderId, name }: { folderId: string; name: string }) =>
      updateFolder(folderId, { name }),
    onSuccess: (updated) => {
      queryClient.setQueryData<FolderItem[]>(queryKeys.folders, (prev = []) =>
        prev
          .map((f) => (f.folder_id === updated.folder_id ? updated : f))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
    },
  });

  const deleteFolderMut = useMutation({
    mutationFn: (folderId: string) => deleteFolder(folderId),
    onSuccess: (_data, folderId) => {
      const fallbackParent =
        folders.find((f) => f.folder_id === folderId)?.parent_id ?? null;
      queryClient.setQueryData<FolderItem[]>(queryKeys.folders, (prev = []) =>
        prev
          .filter((f) => f.folder_id !== folderId)
          .map((f) =>
            f.parent_id === folderId ? { ...f, parent_id: fallbackParent } : f,
          ),
      );
      queryClient.setQueryData<DocumentListItem[]>(
        queryKeys.documents,
        (prev = []) =>
          prev.map((d) =>
            d.folder_id === folderId ? { ...d, folder_id: fallbackParent } : d,
          ),
      );
      if (currentFolderId === folderId) setCurrentFolderId(fallbackParent);
    },
  });

  const moveDocMut = useMutation({
    mutationFn: ({ docId, folderId }: { docId: string; folderId: string | null }) =>
      moveDocumentToFolder(docId, folderId),
    onSuccess: (_data, { docId, folderId }) => {
      queryClient.setQueryData<DocumentListItem[]>(
        queryKeys.documents,
        (prev = []) =>
          prev.map((d) =>
            d.doc_id === docId ? { ...d, folder_id: folderId } : d,
          ),
      );
    },
  });

  const deleteDocMut = useMutation({
    mutationFn: (docId: string) => deleteDocument(docId),
    onSuccess: (_data, docId) => {
      queryClient.setQueryData<DocumentListItem[]>(
        queryKeys.documents,
        (prev = []) => prev.filter((d) => d.doc_id !== docId),
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.storageUsage });
    },
  });

  const deleteAssetMut = useMutation({
    mutationFn: (assetId: string) => deleteAsset(assetId),
    onSuccess: (_data, assetId) => {
      queryClient.setQueryData<AssetItem[]>(queryKeys.assets, (prev = []) =>
        prev.filter((a) => a.asset_id !== assetId),
      );
    },
  });

  const handleCreateFolder = async (name: string, parentId: string | null) => {
    setError(null);
    try {
      await createFolderMut.mutateAsync({ name, parentId });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create folder.");
    }
  };

  const handleRenameFolder = async (folderId: string, name: string) => {
    setError(null);
    try {
      await renameFolderMut.mutateAsync({ folderId, name });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to rename folder.");
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    setError(null);
    try {
      await deleteFolderMut.mutateAsync(folderId);
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
      await moveDocMut.mutateAsync({ docId, folderId });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to move document.");
    }
  };

  const handleDeleteSavedDoc = async (docId: string) => {
    await deleteDocMut.mutateAsync(docId);
  };

  const handleDeleteAsset = async (assetId: string) => {
    await deleteAssetMut.mutateAsync(assetId);
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
