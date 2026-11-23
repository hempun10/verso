import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchAuthConfig,
  fetchOverrideFonts,
  fetchStorageUsage,
  listAssets,
  listDocuments,
  listFolders,
} from "@/api";
import { queryKeys } from "@/lib/queryClient";

const DEFAULT_OVERRIDE_FONTS = [
  "helvetica",
  "times",
  "courier",
  "georgia",
  "verdana",
  "tahoma",
  "trebuchet",
];

export function useWorkspaceQueries(isSignedIn: boolean) {
  const queryClient = useQueryClient();

  const authConfigQuery = useQuery({
    queryKey: queryKeys.authConfig,
    queryFn: fetchAuthConfig,
    staleTime: 5 * 60_000,
  });

  const overrideFontsQuery = useQuery({
    queryKey: queryKeys.overrideFonts,
    queryFn: fetchOverrideFonts,
    enabled: isSignedIn,
    staleTime: Infinity,
    placeholderData: DEFAULT_OVERRIDE_FONTS,
  });

  const docsQuery = useQuery({
    queryKey: queryKeys.documents,
    queryFn: listDocuments,
    enabled: isSignedIn,
  });

  const foldersQuery = useQuery({
    queryKey: queryKeys.folders,
    queryFn: listFolders,
    enabled: isSignedIn,
  });

  const assetsQuery = useQuery({
    queryKey: queryKeys.assets,
    queryFn: () => listAssets(),
    enabled: isSignedIn,
  });

  const storageQuery = useQuery({
    queryKey: queryKeys.storageUsage,
    queryFn: fetchStorageUsage,
    enabled: isSignedIn,
  });

  const refreshWorkspace = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.workspaceRoot,
      refetchType: "active",
    });
  }, [queryClient]);

  const clearWorkspaceCache = useCallback(() => {
    queryClient.removeQueries({ queryKey: queryKeys.workspaceRoot });
    queryClient.removeQueries({ queryKey: queryKeys.documentsRoot });
  }, [queryClient]);

  const workspaceLoading =
    isSignedIn &&
    (docsQuery.isPending || foldersQuery.isPending || assetsQuery.isPending);

  return {
    authConfig: authConfigQuery.data ?? null,
    overrideFonts: overrideFontsQuery.data ?? DEFAULT_OVERRIDE_FONTS,
    savedDocs: docsQuery.data ?? [],
    folders: foldersQuery.data ?? [],
    assets: assetsQuery.data ?? [],
    storageUsage: storageQuery.data ?? null,
    workspaceLoading,
    refreshWorkspace,
    clearWorkspaceCache,
  };
}
