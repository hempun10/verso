import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useWorkspace } from "@/features/workspace/context/WorkspaceContext";
import { useHistory } from "@/hooks/useHistory";
import type { AssetItem, PageOverlay } from "@/types";
import type { EditorContextValue } from "./types";
import {
  type EditMap,
  EMPTY_SNAPSHOT,
  type HistorySnapshot,
  type StampSeed,
  updateUrlParams,
} from "../types";
import { useAssetPlacement } from "../hooks/useAssetPlacement";
import { useDocumentSession } from "../hooks/useDocumentSession";
import { useEditorActions } from "../hooks/useEditorActions";
import { useEditorShortcuts } from "../hooks/useEditorShortcuts";
import { useUploadFlow } from "../hooks/useUploadFlow";

export type { EditorContextValue };

const EditorContext = createContext<EditorContextValue | null>(null);

export function EditorProvider({ children }: { children: ReactNode }) {
  const workspace = useWorkspace();
  const [zoom, setZoom] = useState(1.25);
  const [showBoxes, setShowBoxes] = useState(true);
  const [docsOpen, setDocsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [signOpen, setSignOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [stampOpen, setStampOpen] = useState(false);
  const [stampSeed, setStampSeed] = useState<StampSeed>({});

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const clearSelectionRef = useRef<() => void>(() => {});
  const onClearSelectionBridge = useCallback(
    () => clearSelectionRef.current(),
    [],
  );

  const {
    present: currentSnapshot,
    canUndo,
    canRedo,
    push: pushSnapshot,
    undo,
    redo,
    reset: resetHistory,
  } = useHistory<HistorySnapshot>(EMPTY_SNAPSHOT);
  const editsMap = currentSnapshot.edits;
  const allOverlays = currentSnapshot.overlays;

  const pushEdits = useCallback(
    (updater: (prev: EditMap) => EditMap) =>
      pushSnapshot((snap) => ({ ...snap, edits: updater(snap.edits) })),
    [pushSnapshot],
  );
  const pushOverlays = useCallback(
    (updater: (prev: PageOverlay[]) => PageOverlay[]) =>
      pushSnapshot((snap) => ({ ...snap, overlays: updater(snap.overlays) })),
    [pushSnapshot],
  );

  const session = useDocumentSession({
    editsMap,
    allOverlays,
    resetHistory,
    onClearSelection: onClearSelectionBridge,
    onRefreshWorkspace: workspace.refreshWorkspace,
    onError: workspace.setError,
  });

  const actions = useEditorActions({
    blocks: session.blocks,
    pageOverlays: session.pageOverlays,
    editsMap,
    pageIndex: session.pageIndex,
    zoom,
    pushEdits,
    pushOverlays,
  });
  clearSelectionRef.current = () => {
    actions.clearSelection();
    actions.setToolMode("select");
  };

  const upload = useUploadFlow({
    isSignedIn: workspace.isSignedIn,
    onRequireAuth: () => workspace.setAuthOpen(true),
    uploadLimits: workspace.uploadLimits,
    captchaRequired: workspace.captchaRequired,
    hasActiveDoc: Boolean(session.doc),
    view: workspace.view,
    onSetView: workspace.setView,
    onError: workspace.setError,
    onStartSingleUpload: (busyLabel) => {
      session.setDocLoading(true);
      session.revokePreview();
      session.setBusy(busyLabel);
    },
    onFinishSingleUpload: () => {
      session.setDocLoading(false);
      session.setBusy(null);
    },
    onSingleUploadSuccess: (summary) =>
      session.applyUploadedSummary(summary, workspace.user?.name ?? ""),
    onRefreshWorkspace: workspace.refreshWorkspace,
  });

  const assetsPlacement = useAssetPlacement({
    currentPage: session.currentPage,
    pageIndex: session.pageIndex,
    uploadLimits: workspace.uploadLimits,
    pushOverlays,
    setAssets: workspace.setAssets,
    onPlacedOverlay: (id) => {
      actions.setSelectedId(null);
      actions.setSelectedOverlayId(id);
    },
    onSetToolMode: actions.setToolMode,
  });

  // Deep-link boot: open ?doc=...&share=... only after auth is confirmed.
  const loadSavedDocRef = useRef(session.loadSavedDocument);
  loadSavedDocRef.current = session.loadSavedDocument;
  const setDocLoadingRef = useRef(session.setDocLoading);
  setDocLoadingRef.current = session.setDocLoading;
  const deepLinkHandledRef = useRef(false);
  useEffect(() => {
    if (workspace.authLoading || deepLinkHandledRef.current) return;
    deepLinkHandledRef.current = true;
    const params = new URLSearchParams(window.location.search);
    const urlDoc = params.get("doc");
    if (!urlDoc) return;
    if (!workspace.isSignedIn) {
      setDocLoadingRef.current(false);
      return;
    }
    void Promise.all([
      workspace.refreshWorkspace(),
      loadSavedDocRef.current(urlDoc, params.get("share")),
    ]);
  }, [workspace.authLoading, workspace.isSignedIn, workspace.refreshWorkspace]);

  useEditorShortcuts({
    doc: session.doc,
    currentPage: session.currentPage,
    pageOverlays: session.pageOverlays,
    anyDialogOpen:
      workspace.authOpen ||
      workspace.shortcutsOpen ||
      workspace.legalTab !== null ||
      docsOpen ||
      shareOpen ||
      signOpen ||
      imageOpen ||
      stampOpen ||
      Boolean(upload.pendingUploadFile),
    selectedOverlayId: actions.selectedOverlayId,
    croppingOverlayId: actions.croppingOverlayId,
    draftCrop: actions.draftCrop,
    toolMode: actions.toolMode,
    onPersist: () => void session.persistCurrentState(),
    onToggleShortcuts: () => workspace.setShortcutsOpen(!workspace.shortcutsOpen),
    onUndo: undo,
    onRedo: redo,
    onExport: () => void session.handleExport(),
    onPushOverlays: pushOverlays,
    onSelectOverlay: actions.setSelectedOverlayId,
    onStartCrop: (id, crop) => {
      actions.setCroppingOverlayId(id);
      actions.setDraftCrop(crop);
    },
    onSetToolMode: actions.setToolMode,
    onSetZoom: setZoom,
    onToggleBoxes: () => setShowBoxes((v) => !v),
    onOpenSign: () => setSignOpen(true),
    onOpenImage: () => setImageOpen(true),
    onSetPageIndex: session.setPageIndex,
  });

  const chooseFile = (folderId: string | null = null, checkCaptcha = false) => {
    if (!workspace.isSignedIn) {
      workspace.setAuthOpen(true);
      return;
    }
    if (checkCaptcha && workspace.captchaRequired && !upload.uploadCaptchaToken) {
      workspace.setError(
        "Please complete the human verification check below before uploading.",
      );
      return;
    }
    upload.uploadTargetFolderRef.current = folderId;
    fileInputRef.current?.click();
  };

  const openDashboard = () => {
    if (!workspace.isSignedIn) {
      workspace.setAuthOpen(true);
      return;
    }
    session.setDoc(null);
    actions.clearSelection();
    workspace.setView("dashboard");
    updateUrlParams(null, null, "dashboard");
    void workspace.refreshWorkspace(true);
  };

  const goToLanding = () => {
    session.setDoc(null);
    actions.clearSelection();
    workspace.setView("landing");
    updateUrlParams(null, null, "landing");
  };

  const signOut = async () => {
    session.resetActiveDocument();
    await workspace.handleSignOutWorkspace();
  };

  const deleteDocument = async (docId: string) => {
    await workspace.handleDeleteSavedDoc(docId);
    if (session.doc?.doc_id === docId) {
      session.resetActiveDocument();
      updateUrlParams(null, null);
    }
  };

  const openStampStudio = (opts?: { file?: File; asset?: AssetItem }) => {
    setStampSeed({
      file: opts?.file ?? null,
      imageUrl: opts?.asset?.url ?? null,
      name: opts?.asset?.name ?? "",
    });
    setStampOpen(true);
  };

  return (
    <EditorContext
      value={{
        editsMap, canUndo, canRedo, undo, redo, zoom, setZoom,
        showBoxes, setShowBoxes, docsOpen, setDocsOpen, shareOpen, setShareOpen,
        signOpen, setSignOpen, imageOpen, setImageOpen, stampOpen, setStampOpen,
        stampSeed, openStampStudio, session, actions, upload, assetsPlacement,
        chooseFile, openDashboard, goToLanding, signOut, deleteDocument,
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,image/png,image/jpeg,image/webp"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          const targetFolder = upload.uploadTargetFolderRef.current;
          upload.uploadTargetFolderRef.current = null;
          if (files.length > 0) void upload.handleUploadFiles(files, targetFolder);
          e.target.value = "";
        }}
      />
      {children}
    </EditorContext>
  );
}

export function useEditor(): EditorContextValue {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error("useEditor must be used within EditorProvider");
  return ctx;
}
