import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

export const queryKeys = {
  authConfig: ["auth", "config"] as const,
  overrideFonts: ["config", "override-fonts"] as const,
  workspaceRoot: ["workspace"] as const,
  documents: ["workspace", "documents"] as const,
  folders: ["workspace", "folders"] as const,
  assets: ["workspace", "assets"] as const,
  storageUsage: ["workspace", "storage"] as const,
  documentsRoot: ["documents"] as const,
  documentDetail: (docId: string, shareToken?: string | null) =>
    ["documents", "detail", docId, shareToken ?? ""] as const,
  pageBlocks: (docId: string, pageIndex: number, shareToken?: string | null) =>
    ["documents", "blocks", docId, pageIndex, shareToken ?? ""] as const,
  pagePreview: (
    docId: string,
    pageIndex: number,
    editsKey: string,
    shareToken?: string | null,
  ) =>
    [
      "documents",
      "preview",
      docId,
      pageIndex,
      editsKey,
      shareToken ?? "",
    ] as const,
  stampSource: (url: string) => ["stamps", "source", url] as const,
};
