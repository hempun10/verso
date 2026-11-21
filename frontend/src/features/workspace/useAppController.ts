import { useCallback, useRef, useState } from "react";
import type { LegalTab } from "@/components/LegalDialog";
import type { AppDialogState } from "@/features/editor/EditorModals";
import {
  type EditMap,
  EMPTY_SNAPSHOT,
  type HistorySnapshot,
  type StampSeed,
  updateUrlParams,
} from "@/features/editor/types";
import { useAssetPlacement } from "@/features/editor/useAssetPlacement";
import { useDocumentSession } from "@/features/editor/useDocumentSession";
import { useEditorActions } from "@/features/editor/useEditorActions";
import { useEditorShortcuts } from "@/features/editor/useEditorShortcuts";
import { useUploadFlow } from "@/features/editor/useUploadFlow";
import { useWorkspace } from "@/features/workspace/useWorkspace";
import { useHistory } from "@/hooks/useHistory";
import type { PageOverlay } from "@/types";

export function useAppController() {
  const [error, setError] = useState<string | null>(null);
  const [showBoxes, setShowBoxes] = useState(true);
  const [zoom, setZoom] = useState(1.25);
  const [authOpen, setAuthOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [signOpen, setSignOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [stampOpen, setStampOpen] = useState(false);
  const [stampSeed, setStampSeed] = useState<StampSeed>({});
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [legalTab, setLegalTab] = useState<LegalTab | null>(null);
  const [docMenuOpen, setDocMenuOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const refreshWorkspaceRef = useRef<() => Promise<void>>(async () => {});
  const clearSelectionRef = useRef<() => void>(() => {});
  const bootLoadDocRef = useRef<
    (docId: string, shareToken: string | null) => Promise<void>
  >(async () => {});
  const resetDocumentRef = useRef<() => void>(() => {});
  const activeDocIdRef = useRef<string | null>(null);

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

  const onRefreshWorkspaceBridge = useCallback(
    () => refreshWorkspaceRef.current(),
    [],
  );
  const onClearSelectionBridge = useCallback(
    () => clearSelectionRef.current(),
    [],
  );

  const session = useDocumentSession({
    editsMap,
    allOverlays,
    resetHistory,
    onClearSelection: onClearSelectionBridge,
    onRefreshWorkspace: onRefreshWorkspaceBridge,
    onError: setError,
  });
  activeDocIdRef.current = session.doc?.doc_id ?? null;
  bootLoadDocRef.current = session.loadSavedDocument;
  resetDocumentRef.current = session.resetActiveDocument;

  const onBootLoadDoc = useCallback(
    (docId: string, shareToken: string | null) =>
      bootLoadDocRef.current(docId, shareToken),
    [],
  );
  const onResetDocument = useCallback(() => resetDocumentRef.current(), []);

  const workspace = useWorkspace({
    hasActiveDoc: Boolean(session.doc),
    activeDocId: activeDocIdRef.current,
    onBootLoadDoc,
    onResetDocument,
    onError: setError,
  });
  refreshWorkspaceRef.current = () => workspace.refreshWorkspace();

  const editor = useEditorActions({
    blocks: session.blocks,
    pageOverlays: session.pageOverlays,
    editsMap,
    pageIndex: session.pageIndex,
    zoom,
    pushEdits,
    pushOverlays,
  });
  clearSelectionRef.current = () => {
    editor.clearSelection();
    editor.setToolMode("select");
  };

  const upload = useUploadFlow({
    uploadLimits: workspace.uploadLimits,
    captchaRequired: workspace.captchaRequired,
    hasActiveDoc: Boolean(session.doc),
    view: workspace.view,
    onSetView: workspace.setView,
    onError: setError,
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
    onRefreshWorkspace: () => workspace.refreshWorkspace(),
  });

  const assetsPlacement = useAssetPlacement({
    currentPage: session.currentPage,
    pageIndex: session.pageIndex,
    uploadLimits: workspace.uploadLimits,
    pushOverlays,
    setAssets: workspace.setAssets,
    onPlacedOverlay: (id) => {
      editor.setSelectedId(null);
      editor.setSelectedOverlayId(id);
    },
    onSetToolMode: editor.setToolMode,
  });

  const dialogs: AppDialogState = {
    authOpen, setAuthOpen, docsOpen, setDocsOpen, shareOpen, setShareOpen,
    signOpen, setSignOpen, imageOpen, setImageOpen, stampOpen, setStampOpen,
    stampSeed, setStampSeed, shortcutsOpen, setShortcutsOpen, legalTab, setLegalTab,
  };

  useEditorShortcuts({
    doc: session.doc,
    currentPage: session.currentPage,
    pageOverlays: session.pageOverlays,
    anyDialogOpen:
      authOpen || docsOpen || shareOpen || signOpen || imageOpen || stampOpen ||
      shortcutsOpen || legalTab !== null || Boolean(upload.pendingUploadFile),
    selectedOverlayId: editor.selectedOverlayId,
    croppingOverlayId: editor.croppingOverlayId,
    draftCrop: editor.draftCrop,
    toolMode: editor.toolMode,
    onPersist: () => void session.persistCurrentState(),
    onToggleShortcuts: () => setShortcutsOpen((v) => !v),
    onUndo: undo,
    onRedo: redo,
    onExport: () => void session.handleExport(),
    onPushOverlays: pushOverlays,
    onSelectOverlay: editor.setSelectedOverlayId,
    onStartCrop: (id, crop) => {
      editor.setCroppingOverlayId(id);
      editor.setDraftCrop(crop);
    },
    onSetToolMode: editor.setToolMode,
    onSetZoom: setZoom,
    onToggleBoxes: () => setShowBoxes((v) => !v),
    onOpenSign: () => setSignOpen(true),
    onOpenImage: () => setImageOpen(true),
    onSetPageIndex: session.setPageIndex,
  });

  const openDashboard = () => {
    session.setDoc(null);
    editor.clearSelection();
    workspace.setView("dashboard");
    updateUrlParams(null, null, "dashboard");
    void workspace.refreshWorkspace(true);
  };

  const goToLanding = () => {
    session.setDoc(null);
    editor.clearSelection();
    workspace.setView("landing");
    updateUrlParams(null, null, "landing");
  };

  const openFilePickerWithCaptchaCheck = () => {
    if (workspace.captchaRequired && !upload.uploadCaptchaToken) {
      setError(
        "Please complete the human verification check below before uploading.",
      );
      return;
    }
    upload.uploadTargetFolderRef.current = null;
    fileInputRef.current?.click();
  };

  return {
    error, setError, showBoxes, setShowBoxes, zoom, setZoom,
    docMenuOpen, setDocMenuOpen, fileInputRef,
    editsMap, canUndo, canRedo, undo, redo,
    session, workspace, editor, upload, assetsPlacement, dialogs,
    openDashboard, goToLanding, openFilePickerWithCaptchaCheck,
  };
}
