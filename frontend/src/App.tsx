import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Download,
  Eraser,
  Eye,
  EyeOff,
  FolderOpen,
  ImagePlus,
  Keyboard,
  Loader2,
  LogIn,
  LogOut,
  MousePointer2,
  PenTool,
  Redo2,
  RefreshCw,
  Save,
  Share2,
  Sparkles,
  Undo2,
  Upload,
  User as UserIcon,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  createAsset,
  createFolder,
  deleteAsset,
  deleteDocument,
  deleteFolder,
  devLogin,
  exportEditedImage,
  exportEditedPdf,
  fetchAuthConfig,
  fetchCurrentUser,
  fetchDocumentDetail,
  fetchOverrideFonts,
  fetchPageBlocks,
  fetchPagePreview,
  fetchStorageUsage,
  listAssets,
  listDocuments,
  listFolders,
  moveDocumentToFolder,
  saveDocumentState,
  setDocumentShare,
  updateFolder,
  uploadDocument,
} from "@/api";
import { AuthDialog } from "@/components/AuthDialog";
import { BRAND_NAME, BrandLogo } from "@/components/BrandLogo";
import { InspectorBar } from "@/components/InspectorBar";
import { LandingPage } from "@/components/LandingPage";
import type { LegalTab } from "@/components/LegalDialog";
import { OverlayInspectorBar } from "@/components/OverlayInspectorBar";
import {
  computeCroppedPatch,
  OverlayLayer,
  type CropBox,
} from "@/components/OverlayLayer";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import {
  UploadQueueToast,
  type UploadQueueItem,
} from "@/components/UploadQueueToast";
import { DocumentsDialog, ShareDialog } from "@/components/WorkspaceDialogs";

const DashboardPage = lazy(() =>
  import("@/components/DashboardPage").then((m) => ({
    default: m.DashboardPage,
  })),
);
const ImageLibraryDialog = lazy(() =>
  import("@/components/ImageLibraryDialog").then((m) => ({
    default: m.ImageLibraryDialog,
  })),
);
const LegalDialog = lazy(() =>
  import("@/components/LegalDialog").then((m) => ({
    default: m.LegalDialog,
  })),
);
const ShortcutsDialog = lazy(() =>
  import("@/components/ShortcutsDialog").then((m) => ({
    default: m.ShortcutsDialog,
  })),
);
const SignaturePadDialog = lazy(() =>
  import("@/components/SignaturePadDialog").then((m) => ({
    default: m.SignaturePadDialog,
  })),
);
const StampStudioDialog = lazy(() =>
  import("@/components/StampStudioDialog").then((m) => ({
    default: m.StampStudioDialog,
  })),
);
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  restoreAppwriteSession,
  setDevAuthToken,
  signOutEverywhere,
  startAppwriteOAuth,
} from "@/lib/auth";
import { useDebouncedAutoSave } from "@/hooks/useDebouncedSave";
import { useHistory } from "@/hooks/useHistory";
import { useWindowKeyDown } from "@/hooks/useKeyboardShortcuts";
import { isEditableTarget } from "@/lib/dom";
import {
  readFileAsDataUrl,
  stripFileExtension,
  triggerDownload,
} from "@/lib/format";
import {
  applyStyleToRange,
  cssFontStack,
  editorBackgroundForRuns,
  extractStyle,
  getActiveStyleForRange,
  getInitialRuns,
  getSelectionOffsets,
  parseRunsFromDom,
  renderRunsIntoDom,
  runsToEdit,
  runsToPlainText,
  setSelectionOffsets,
  transformCaseInRange,
  type SelectionRange,
} from "@/lib/runs";
import { cn } from "@/lib/utils";
import {
  DEFAULT_UPLOAD_LIMITS,
  isImageFilename,
  MAX_BATCH_UPLOAD_FILES,
  validateDocumentFileClient,
  validateImageFileClient,
} from "@/lib/validation";
import type {
  AssetItem,
  AuthConfig,
  DocumentDetail,
  DocumentListItem,
  DocumentSummary,
  FolderItem,
  ImageOverlay,
  PageOverlay,
  StorageUsage,
  TextBlock,
  TextEdit,
  TextRun,
  TextRunStyle,
  ToolMode,
  UserInfo,
  WhiteoutOverlay,
} from "@/types";

type EditMap = Record<string, TextEdit>;

interface HistorySnapshot {
  edits: EditMap;
  overlays: PageOverlay[];
}

interface DocMeta {
  isOwner: boolean;
  isShared: boolean;
  shareToken: string | null;
  version: number;
  updatedBy: string;
}

const EMPTY_SNAPSHOT: HistorySnapshot = { edits: {}, overlays: [] };

function makeOverlayId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function editsListToMap(edits: TextEdit[]): EditMap {
  const map: EditMap = {};
  for (const e of edits) map[e.block_id] = e;
  return map;
}

function updateUrlParams(
  docId: string | null,
  shareToken: string | null,
  view: "landing" | "dashboard" = "landing",
) {
  const url = new URL(window.location.href);
  if (docId) {
    url.searchParams.set("doc", docId);
    url.searchParams.delete("view");
    if (shareToken) url.searchParams.set("share", shareToken);
    else url.searchParams.delete("share");
  } else {
    url.searchParams.delete("doc");
    url.searchParams.delete("share");
    if (view === "dashboard") url.searchParams.set("view", "dashboard");
    else url.searchParams.delete("view");
  }
  window.history.replaceState({}, "", url.toString());
}

export function App() {
  // Auth & workspace state
  const [authConfig, setAuthConfig] = useState<AuthConfig | null>(null);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [view, setView] = useState<"landing" | "dashboard">(() =>
    new URLSearchParams(window.location.search).get("view") === "dashboard"
      ? "dashboard"
      : "landing",
  );
  const [workspaceLoading, setWorkspaceLoading] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search);
    return Boolean(params.get("doc") || params.get("view") === "dashboard");
  });
  const [savedDocs, setSavedDocs] = useState<DocumentListItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [storageUsage, setStorageUsage] = useState<StorageUsage | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const uploadTargetFolderRef = useRef<string | null>(null);

  // Active document & session state
  const [doc, setDoc] = useState<DocumentSummary | null>(null);
  const [docLoading, setDocLoading] = useState<boolean>(() =>
    Boolean(new URLSearchParams(window.location.search).get("doc")),
  );
  const [exporting, setExporting] = useState(false);
  const [docMeta, setDocMeta] = useState<DocMeta>({
    isOwner: true,
    isShared: false,
    shareToken: null,
    version: 1,
    updatedBy: "",
  });
  const [activeShareToken, setActiveShareToken] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle",
  );

  // Dialogs & menus
  const [authOpen, setAuthOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [signOpen, setSignOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [stampOpen, setStampOpen] = useState(false);
  const [stampSeed, setStampSeed] = useState<{
    file?: File | null;
    imageUrl?: string | null;
    name?: string;
  }>({});
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [legalTab, setLegalTab] = useState<LegalTab | null>(null);
  const [docMenuOpen, setDocMenuOpen] = useState(false);
  const [uploadCaptchaToken, setUploadCaptchaToken] = useState<string | null>(
    null,
  );
  const [uploadCaptchaResetKey, setUploadCaptchaResetKey] = useState(0);
  const [pendingUploadFile, setPendingUploadFile] = useState<File | null>(null);
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);

  const uploadLimits = authConfig?.limits ?? DEFAULT_UPLOAD_LIMITS;
  const captchaRequired = Boolean(
    authConfig?.captcha_enabled && authConfig.turnstile_site_key,
  );

  // Editor state
  const [pageIndex, setPageIndex] = useState(0);
  const [blocks, setBlocks] = useState<TextBlock[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(
    null,
  );
  const [croppingOverlayId, setCroppingOverlayId] = useState<string | null>(
    null,
  );
  const [draftCrop, setDraftCrop] = useState<CropBox | null>(null);
  const [toolMode, setToolMode] = useState<ToolMode>("select");
  const [draftRuns, setDraftRuns] = useState<TextRun[]>([]);
  const [selectionRange, setSelectionRange] = useState<SelectionRange | null>(
    null,
  );
  const [overrideFonts, setOverrideFonts] = useState<string[]>([
    "helvetica",
    "times",
    "courier",
    "georgia",
    "verdana",
    "tahoma",
    "trebuchet",
  ]);

  // Unified lossless undo/redo history for both text edits and overlays.
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

  const [preview, setPreview] = useState<{
    key: string;
    url: string;
    loaded: boolean;
  } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showBoxes, setShowBoxes] = useState(true);
  const [zoom, setZoom] = useState(1.25);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const inspectorRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const inspectorPointerDownRef = useRef(false);
  const skippedBlurBlockIdRef = useRef<string | null>(null);
  const draftRunsRef = useRef<TextRun[]>([]);
  const selectionRangeRef = useRef<SelectionRange | null>(null);
  const lastSavedKeyRef = useRef<string>("");
  const handleExportRef = useRef<() => Promise<void>>(async () => {});

  const savedSignatures = useMemo(
    () => assets.filter((a) => a.kind === "signature"),
    [assets],
  );
  const savedImages = useMemo(
    () => assets.filter((a) => a.kind === "image"),
    [assets],
  );

  const refreshWorkspace = useCallback(async (showLoader = false) => {
    if (showLoader) setWorkspaceLoading(true);
    try {
      const [docsList, foldersList, assetsList, storage] = await Promise.all([
        listDocuments(),
        listFolders(),
        listAssets(),
        fetchStorageUsage().catch(() => null),
      ]);
      setSavedDocs(docsList);
      setFolders(foldersList);
      setAssets(assetsList);
      if (storage) setStorageUsage(storage);
    } catch {
      // Ignore if backend isn't ready yet.
    } finally {
      setWorkspaceLoading(false);
    }
  }, []);

  const openDashboard = useCallback(() => {
    setDoc(null);
    setSelectedId(null);
    setSelectedOverlayId(null);
    setCroppingOverlayId(null);
    setDraftCrop(null);
    setView("dashboard");
    updateUrlParams(null, null, "dashboard");
    void refreshWorkspace(true);
  }, [refreshWorkspace]);

  const goToLanding = useCallback(() => {
    setDoc(null);
    setSelectedId(null);
    setSelectedOverlayId(null);
    setCroppingOverlayId(null);
    setDraftCrop(null);
    setView("landing");
    updateUrlParams(null, null, "landing");
  }, []);

  const loadSavedDocument = useCallback(
    async (docId: string, shareToken: string | null = null) => {
      setError(null);
      setDocLoading(true);
      setPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return null;
      });
      setBusy("Loading document...");
      try {
        const detail: DocumentDetail = await fetchDocumentDetail(
          docId,
          shareToken,
        );
        const restoredSnapshot: HistorySnapshot = {
          edits: editsListToMap(detail.edits),
          overlays: detail.overlays,
        };
        lastSavedKeyRef.current = JSON.stringify({
          edits: detail.edits,
          overlays: detail.overlays,
        });
        setDoc({
          doc_id: detail.doc_id,
          filename: detail.filename,
          page_count: detail.page_count,
          pages: detail.pages,
        });
        setDocMeta({
          isOwner: detail.is_owner,
          isShared: detail.is_shared,
          shareToken: detail.share_token ?? shareToken,
          version: detail.version,
          updatedBy: detail.updated_by,
        });
        setActiveShareToken(shareToken);
        setPageIndex(0);
        setBlocks([]);
        setSelectedId(null);
        setSelectedOverlayId(null);
        setCroppingOverlayId(null);
        setDraftCrop(null);
        setToolMode("select");
        resetHistory(restoredSnapshot);
        setSaveStatus("saved");
        updateUrlParams(detail.doc_id, shareToken);
      } catch (err: unknown) {
        setDoc(null);
        setError(
          err instanceof Error ? err.message : "Failed to open document.",
        );
      } finally {
        setDocLoading(false);
        setBusy(null);
      }
    },
    [resetHistory],
  );

  // Initial boot: fonts, auth config, session restore, workspace list, URL doc deep-link.
  useEffect(() => {
    fetchOverrideFonts()
      .then(setOverrideFonts)
      .catch(() => {});

    void (async () => {
      try {
        const cfg = await fetchAuthConfig();
        setAuthConfig(cfg);
        if (cfg.mode === "appwrite") {
          const awUser = await restoreAppwriteSession(cfg);
          if (awUser) {
            setUser(awUser);
          } else {
            const me = await fetchCurrentUser();
            setUser(me);
          }
        } else {
          const me = await fetchCurrentUser();
          setUser(me);
        }
      } catch {
        // Keep guest mode if auth endpoint unreachable.
      } finally {
        setAuthLoading(false);
      }

      const params = new URLSearchParams(window.location.search);
      const urlDoc = params.get("doc");
      const urlShare = params.get("share");
      const urlView = params.get("view");

      // Only load workspace files/folders when opening a document or the dashboard —
      // never fetch recent saves on the public landing page.
      if (urlDoc) {
        await Promise.all([
          refreshWorkspace(),
          loadSavedDocument(urlDoc, urlShare),
        ]);
      } else if (urlView === "dashboard") {
        await refreshWorkspace(true);
      } else {
        setWorkspaceLoading(false);
      }
    })();
  }, [loadSavedDocument, refreshWorkspace]);

  const currentPage = doc?.pages[pageIndex] ?? null;
  const currentPageKey = doc ? `${doc.doc_id}:${pageIndex}` : "";
  const activePreview =
    preview && preview.key === currentPageKey ? preview : null;
  const isCanvasReady = Boolean(activePreview && activePreview.loaded);

  const pageBlocks = useMemo(
    () => blocks.filter((b) => b.page_index === pageIndex),
    [blocks, pageIndex],
  );

  const pageEdits = useMemo(() => {
    const pageIds = new Set(pageBlocks.map((b) => b.id));
    return Object.values(editsMap).filter((e) => pageIds.has(e.block_id));
  }, [pageBlocks, editsMap]);

  const pageOverlays = useMemo(
    () => allOverlays.filter((o) => o.page_index === pageIndex),
    [allOverlays, pageIndex],
  );

  const allEdits = useMemo(() => Object.values(editsMap), [editsMap]);
  const totalChanges = allEdits.length + allOverlays.length;

  const selectedBlock = useMemo(
    () => blocks.find((b) => b.id === selectedId) ?? null,
    [blocks, selectedId],
  );
  const selectedEdit = selectedId ? (editsMap[selectedId] ?? null) : null;
  const selectedOverlay = useMemo(
    () => pageOverlays.find((o) => o.id === selectedOverlayId) ?? null,
    [pageOverlays, selectedOverlayId],
  );

  const serializedDocState = useMemo(
    () => JSON.stringify({ edits: allEdits, overlays: allOverlays }),
    [allEdits, allOverlays],
  );

  const persistCurrentState = useCallback(async () => {
    if (!doc) return;
    if (serializedDocState === lastSavedKeyRef.current) {
      setSaveStatus("saved");
      return;
    }
    setSaveStatus("saving");
    try {
      const res = await saveDocumentState(
        doc.doc_id,
        allEdits,
        allOverlays,
        activeShareToken,
      );
      lastSavedKeyRef.current = serializedDocState;
      setDocMeta((m) => ({
        ...m,
        version: res.version,
        updatedBy: res.updated_by,
      }));
      setSaveStatus("saved");
      void refreshWorkspace();
    } catch (err: unknown) {
      setSaveStatus("idle");
      setError(err instanceof Error ? err.message : "Failed to save session.");
    }
  }, [
    activeShareToken,
    allEdits,
    allOverlays,
    doc,
    refreshWorkspace,
    serializedDocState,
  ]);

  // Debounced auto-save whenever edits or overlays change.
  useDebouncedAutoSave({
    enabled: Boolean(doc),
    serializedKey: serializedDocState,
    lastSavedKey: lastSavedKeyRef.current,
    delayMs: 1100,
    onDirty: () => setSaveStatus("idle"),
    onSave: persistCurrentState,
  });

  const pushEdits = useCallback(
    (updater: (prev: EditMap) => EditMap) => {
      pushSnapshot((snap) => ({
        ...snap,
        edits: updater(snap.edits),
      }));
    },
    [pushSnapshot],
  );

  const pushOverlays = useCallback(
    (updater: (prev: PageOverlay[]) => PageOverlay[]) => {
      pushSnapshot((snap) => ({
        ...snap,
        overlays: updater(snap.overlays),
      }));
    },
    [pushSnapshot],
  );

  // Populate & focus the contentEditable rich editor when selecting a block.
  useLayoutEffect(() => {
    const el = editorRef.current;
    if (!el || !selectedBlock) return;
    renderRunsIntoDom(el, draftRunsRef.current, selectedBlock, zoom);
    el.focus();
    const len = runsToPlainText(draftRunsRef.current).length;
    setSelectionOffsets(el, len, len);
    selectionRangeRef.current = { start: len, end: len };
    setSelectionRange({ start: len, end: len });
  }, [selectedBlock, zoom]);

  // Track character selection offsets whenever selection changes inside `.inline-editor`.
  useEffect(() => {
    if (!selectedId) return;
    const onSelectionChange = () => {
      const el = editorRef.current;
      if (!el) return;
      const offsets = getSelectionOffsets(el);
      if (offsets) {
        selectionRangeRef.current = offsets;
        setSelectionRange(offsets);
      }
    };
    document.addEventListener("selectionchange", onSelectionChange);
    return () =>
      document.removeEventListener("selectionchange", onSelectionChange);
  }, [selectedId]);

  // Global keyboard shortcuts: tools, view, overlay nudge/rotate/crop, save, undo/redo, export, ?.
  useWindowKeyDown((e) => {
      const mod = e.metaKey || e.ctrlKey;
      const keyLower = e.key.toLowerCase();

      // Always allow Cmd/Ctrl+S save and Cmd/Ctrl+/ shortcuts modal.
      if (mod && keyLower === "s") {
        e.preventDefault();
        void persistCurrentState();
        return;
      }
      if (mod && e.key === "/") {
        e.preventDefault();
        setShortcutsOpen((v) => !v);
        return;
      }

      if (isEditableTarget(e.target)) return;

      // Ignore single-key shortcuts when a modal dialog is open.
      const anyDialogOpen =
        authOpen ||
        docsOpen ||
        shareOpen ||
        signOpen ||
        imageOpen ||
        stampOpen ||
        shortcutsOpen ||
        legalTab !== null ||
        Boolean(pendingUploadFile);

      if (e.key === "?" && !mod && !e.altKey) {
        e.preventDefault();
        setShortcutsOpen((v) => !v);
        return;
      }

      if (anyDialogOpen) return;

      // Undo / Redo (Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z, Ctrl+Y)
      if (mod && keyLower === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }
      if (e.ctrlKey && !e.metaKey && keyLower === "y") {
        e.preventDefault();
        redo();
        return;
      }

      if (!doc) return;

      // Export PDF (Cmd/Ctrl+E)
      if (mod && keyLower === "e") {
        e.preventDefault();
        void handleExportRef.current();
        return;
      }

      // Duplicate selected overlay (Cmd/Ctrl+D)
      if (mod && keyLower === "d" && selectedOverlayId && !croppingOverlayId) {
        const targetOv = pageOverlays.find((o) => o.id === selectedOverlayId);
        if (targetOv) {
          e.preventDefault();
          const offset = 14;
          const [x0, y0, x1, y1] = targetOv.bbox;
          const copy: PageOverlay = {
            ...targetOv,
            id: makeOverlayId(targetOv.kind === "whiteout" ? "wo" : "img"),
            bbox: [
              +(x0 + offset).toFixed(2),
              +(y0 + offset).toFixed(2),
              +(x1 + offset).toFixed(2),
              +(y1 + offset).toFixed(2),
            ],
          };
          pushOverlays((prev) => [...prev, copy]);
          setSelectedOverlayId(copy.id);
        }
        return;
      }

      // Apply crop on Enter
      if (e.key === "Enter" && croppingOverlayId && draftCrop) {
        e.preventDefault();
        const targetOv = pageOverlays.find(
          (o): o is ImageOverlay =>
            o.id === croppingOverlayId && o.kind === "image",
        );
        if (targetOv) {
          const patch = computeCroppedPatch(targetOv, draftCrop);
          pushOverlays((prev) =>
            prev.map((o) =>
              o.id === targetOv.id ? ({ ...o, ...patch } as PageOverlay) : o,
            ),
          );
        }
        setCroppingOverlayId(null);
        setDraftCrop(null);
        return;
      }

      // Escape: cancel crop -> exit whiteout -> deselect overlay
      if (e.key === "Escape") {
        if (croppingOverlayId) {
          setCroppingOverlayId(null);
          setDraftCrop(null);
        } else if (toolMode !== "select") {
          setToolMode("select");
        } else if (selectedOverlayId) {
          setSelectedOverlayId(null);
        }
        return;
      }

      // Delete selected overlay
      if (
        (e.key === "Backspace" || e.key === "Delete") &&
        selectedOverlayId &&
        !croppingOverlayId
      ) {
        e.preventDefault();
        const delId = selectedOverlayId;
        setSelectedOverlayId(null);
        pushOverlays((prev) => prev.filter((o) => o.id !== delId));
        return;
      }

      // Arrow keys: nudge selected overlay by 1pt (Shift = 10pt)
      if (
        selectedOverlayId &&
        !croppingOverlayId &&
        !mod &&
        (e.key === "ArrowUp" ||
          e.key === "ArrowDown" ||
          e.key === "ArrowLeft" ||
          e.key === "ArrowRight")
      ) {
        const targetOv = pageOverlays.find((o) => o.id === selectedOverlayId);
        if (targetOv && currentPage) {
          e.preventDefault();
          const step = e.shiftKey ? 10 : 1;
          const dx =
            e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
          const dy =
            e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
          const [x0, y0, x1, y1] = targetOv.bbox;
          const w = x1 - x0;
          const h = y1 - y0;
          const nx0 = Math.max(0, Math.min(currentPage.width_pt - w, x0 + dx));
          const ny0 = Math.max(0, Math.min(currentPage.height_pt - h, y0 + dy));
          const nextBbox: [number, number, number, number] = [
            +nx0.toFixed(2),
            +ny0.toFixed(2),
            +(nx0 + w).toFixed(2),
            +(ny0 + h).toFixed(2),
          ];
          pushOverlays((prev) =>
            prev.map((o) =>
              o.id === targetOv.id ? ({ ...o, bbox: nextBbox } as PageOverlay) : o,
            ),
          );
        }
        return;
      }

      // Zoom shortcuts (+ / =, -, 0 — with or without Cmd/Ctrl)
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        setZoom((z) => Math.min(2.4, +(z + 0.15).toFixed(2)));
        return;
      }
      if (e.key === "-") {
        e.preventDefault();
        setZoom((z) => Math.max(0.6, +(z - 0.15).toFixed(2)));
        return;
      }
      if (e.key === "0") {
        e.preventDefault();
        setZoom(1.25);
        return;
      }

      if (mod || e.altKey) return;

      // Single-key tool, view, and overlay shortcuts
      if (keyLower === "v") {
        e.preventDefault();
        setToolMode("select");
      } else if (keyLower === "w") {
        e.preventDefault();
        setSelectedOverlayId(null);
        setCroppingOverlayId(null);
        setDraftCrop(null);
        setToolMode((m) => (m === "whiteout" ? "select" : "whiteout"));
      } else if (keyLower === "g") {
        e.preventDefault();
        setSignOpen(true);
      } else if (keyLower === "i") {
        e.preventDefault();
        setImageOpen(true);
      } else if (keyLower === "b") {
        e.preventDefault();
        setShowBoxes((v) => !v);
      } else if (e.key === "[" || e.key === "PageUp") {
        if (doc.page_count > 1) {
          e.preventDefault();
          setPageIndex((i) => Math.max(0, i - 1));
        }
      } else if (e.key === "]" || e.key === "PageDown") {
        if (doc.page_count > 1) {
          e.preventDefault();
          setPageIndex((i) => Math.min(doc.page_count - 1, i + 1));
        }
      } else if (keyLower === "c" && selectedOverlayId && !croppingOverlayId) {
        const targetOv = pageOverlays.find(
          (o): o is ImageOverlay =>
            o.id === selectedOverlayId && o.kind === "image",
        );
        if (targetOv) {
          e.preventDefault();
          setCroppingOverlayId(targetOv.id);
          setDraftCrop(targetOv.crop ?? [0, 0, 1, 1]);
        }
      } else if (keyLower === "r" && selectedOverlayId && !croppingOverlayId) {
        const targetOv = pageOverlays.find(
          (o): o is ImageOverlay =>
            o.id === selectedOverlayId && o.kind === "image",
        );
        if (targetOv) {
          e.preventDefault();
          const delta = e.shiftKey ? -15 : 15;
          const nextAngle = Math.max(-180, Math.min(180, targetOv.angle_deg + delta));
          pushOverlays((prev) =>
            prev.map((o) =>
              o.id === targetOv.id
                ? ({ ...o, angle_deg: nextAngle } as PageOverlay)
                : o,
            ),
          );
        }
      }
  });

  // Load blocks & clear stale page state whenever document or page changes.
  useEffect(() => {
    setBlocks([]);
    setPreview((prev) => {
      if (prev && prev.key !== currentPageKey) {
        URL.revokeObjectURL(prev.url);
        return null;
      }
      return prev;
    });
    if (!doc) return;
    let cancelled = false;
    setSelectedId(null);
    setSelectedOverlayId(null);
    setCroppingOverlayId(null);
    setDraftCrop(null);
    setBusy(
      doc.pages[pageIndex]?.kind === "scanned"
        ? "Running OCR on scanned page..."
        : "Extracting text blocks...",
    );
    setError(null);

    fetchPageBlocks(doc.doc_id, pageIndex, activeShareToken)
      .then((loaded) => {
        if (!cancelled) setBlocks(loaded);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load page.");
      })
      .finally(() => {
        if (!cancelled) setBusy(null);
      });

    return () => {
      cancelled = true;
    };
  }, [activeShareToken, currentPageKey, doc, pageIndex]);

  // Refresh server-rendered WYSIWYG page preview whenever page or pageEdits change.
  useEffect(() => {
    if (!doc) return;
    const targetKey = `${doc.doc_id}:${pageIndex}`;
    let cancelled = false;
    setBusy("Rendering preview...");

    fetchPagePreview(doc.doc_id, pageIndex, pageEdits, 150, activeShareToken)
      .then((blob) => {
        if (cancelled) return;
        const nextUrl = URL.createObjectURL(blob);
        setPreview((prev) => {
          if (prev) URL.revokeObjectURL(prev.url);
          // Keep loaded=true when updating the same already-visible page in place.
          const keepVisible = Boolean(
            prev && prev.key === targetKey && prev.loaded,
          );
          return { key: targetKey, url: nextUrl, loaded: keepVisible };
        });
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : "Failed to render preview.",
          );
      })
      .finally(() => {
        if (!cancelled) setBusy(null);
      });

    return () => {
      cancelled = true;
    };
  }, [activeShareToken, doc, pageIndex, pageEdits]);

  const markInspectorPointerDown = () => {
    inspectorPointerDownRef.current = true;
    window.setTimeout(() => {
      inspectorPointerDownRef.current = false;
    }, 0);
  };

  const handleUpload = async (
    file: File,
    explicitCaptchaToken?: string | null,
    folderId?: string | null,
  ) => {
    setError(null);
    // Validate PDF or image client-side BEFORE sending any bytes.
    const validationError = await validateDocumentFileClient(file, uploadLimits);
    if (validationError) {
      setError(validationError);
      return;
    }

    const token = explicitCaptchaToken ?? uploadCaptchaToken;
    if (captchaRequired && !token) {
      if (doc || view === "dashboard") {
        uploadTargetFolderRef.current = folderId ?? null;
        setPendingUploadFile(file);
      } else {
        setError(
          "Please complete the human verification check below before uploading.",
        );
      }
      return;
    }

    setPendingUploadFile(null);
    setDocLoading(true);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
    setBusy(
      isImageFilename(file.name)
        ? "Uploading and analyzing image..."
        : "Uploading and analyzing PDF...",
    );
    try {
      const summary = await uploadDocument(file, token, folderId);
      lastSavedKeyRef.current = JSON.stringify({ edits: [], overlays: [] });
      setDoc(summary);
      setDocMeta({
        isOwner: true,
        isShared: false,
        shareToken: null,
        version: 1,
        updatedBy: user?.name ?? "",
      });
      setActiveShareToken(null);
      setPageIndex(0);
      setBlocks([]);
      setSelectedId(null);
      setSelectedOverlayId(null);
      setCroppingOverlayId(null);
      setDraftCrop(null);
      setToolMode("select");
      resetHistory(EMPTY_SNAPSHOT);
      setSaveStatus("saved");
      updateUrlParams(summary.doc_id, null);
      void refreshWorkspace();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setDocLoading(false);
      setBusy(null);
      if (captchaRequired) {
        setUploadCaptchaToken(null);
        setUploadCaptchaResetKey((k) => k + 1);
      }
    }
  };

  const handleUploadFiles = async (
    files: File[],
    folderId?: string | null,
  ) => {
    if (files.length === 0) return;
    if (files.length === 1) {
      await handleUpload(files[0]!, undefined, folderId);
      return;
    }

    setError(null);
    if (captchaRequired) {
      setError(
        "Security verification is active — please upload one file at a time.",
      );
      return;
    }
    if (files.length > MAX_BATCH_UPLOAD_FILES) {
      setError(
        `You can upload up to ${MAX_BATCH_UPLOAD_FILES} files at a time (you selected ${files.length}).`,
      );
      return;
    }

    // Show the Drive dashboard so users see all uploaded files land in their folder.
    if (!doc && view !== "dashboard") {
      setView("dashboard");
      updateUrlParams(null, null, "dashboard");
      void refreshWorkspace();
    }

    const batchId = Date.now().toString(36);
    const entries = files.map((file, idx) => ({
      id: `up_${batchId}_${idx}`,
      file,
    }));

    // Validate every file client-side first (0 network bytes sent for invalid/oversized files).
    const validated = await Promise.all(
      entries.map(async (entry) => ({
        ...entry,
        validationError: await validateDocumentFileClient(
          entry.file,
          uploadLimits,
        ),
      })),
    );

    const initialQueue: UploadQueueItem[] = validated.map((v) => ({
      id: v.id,
      filename: v.file.name,
      status: v.validationError ? "error" : "queued",
      error: v.validationError ?? undefined,
    }));
    setUploadQueue((prev) => [...initialQueue, ...prev.slice(0, 12)]);

    const validWork = validated.filter((v) => !v.validationError);
    if (validWork.length === 0) return;

    // Upload with bounded concurrency (2 at a time) so we stay well within rate limits and keep the UI smooth.
    const CONCURRENCY = 2;
    let cursor = 0;
    const runWorker = async () => {
      while (cursor < validWork.length) {
        const current = validWork[cursor++]!;
        setUploadQueue((prev) =>
          prev.map((item) =>
            item.id === current.id ? { ...item, status: "uploading" } : item,
          ),
        );
        try {
          const summary = await uploadDocument(current.file, null, folderId);
          setUploadQueue((prev) =>
            prev.map((item) =>
              item.id === current.id
                ? { ...item, status: "done", docId: summary.doc_id }
                : item,
            ),
          );
          void refreshWorkspace();
        } catch (err: unknown) {
          const msg =
            err instanceof Error ? err.message : "Upload failed.";
          setUploadQueue((prev) =>
            prev.map((item) =>
              item.id === current.id
                ? { ...item, status: "error", error: msg }
                : item,
            ),
          );
        }
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, validWork.length) }, () =>
        runWorker(),
      ),
    );
  };

  const placeImageOnCurrentPage = useCallback(
    (
      opts: {
        assetId?: string | null;
        assetUrl?: string | null;
        dataUrl?: string | null;
        natW: number;
        natH: number;
        maxWidthFrac?: number;
        opacity?: number;
        angleDeg?: number;
      },
    ) => {
      if (!currentPage) return;
      const maxFrac = opts.maxWidthFrac ?? 0.34;
      let targetW = Math.min(currentPage.width_pt * maxFrac, 220);
      let targetH = targetW * (Math.max(1, opts.natH) / Math.max(1, opts.natW));
      const maxH = currentPage.height_pt * 0.4;
      if (targetH > maxH) {
        targetH = maxH;
        targetW = targetH * (Math.max(1, opts.natW) / Math.max(1, opts.natH));
      }
      const x0 = +((currentPage.width_pt - targetW) / 2).toFixed(2);
      const y0 = +((currentPage.height_pt - targetH) / 2).toFixed(2);
      const overlay: ImageOverlay = {
        id: makeOverlayId("img"),
        kind: "image",
        page_index: pageIndex,
        bbox: [x0, y0, +(x0 + targetW).toFixed(2), +(y0 + targetH).toFixed(2)],
        asset_id: opts.assetId ?? null,
        asset_url: opts.assetUrl ?? null,
        data_url: opts.assetId ? null : (opts.dataUrl ?? null),
        opacity: opts.opacity ?? 1,
        angle_deg: opts.angleDeg ?? 0,
      };
      setSelectedId(null);
      setToolMode("select");
      pushOverlays((prev) => [...prev, overlay]);
      setSelectedOverlayId(overlay.id);
    },
    [currentPage, pageIndex, pushOverlays],
  );

  const handleUploadImageAssetAndPlace = async (file: File) => {
    const validationError = validateImageFileClient(file, uploadLimits);
    if (validationError) {
      throw new Error(validationError);
    }
    const dataUrl = await readFileAsDataUrl(file);
    const saved = await createAsset(
      "image",
      stripFileExtension(file.name, "Image"),
      dataUrl,
    );
    setAssets((prev) => [saved, ...prev]);
    placeImageOnCurrentPage({
      assetId: saved.asset_id,
      assetUrl: saved.url,
      natW: saved.width,
      natH: saved.height,
    });
  };

  const handlePlaceNewSignature = async (
    dataUrl: string,
    width: number,
    height: number,
    saveToLibrary: boolean,
    name: string,
  ) => {
    if (saveToLibrary) {
      const saved = await createAsset("signature", name, dataUrl);
      setAssets((prev) => [saved, ...prev]);
      placeImageOnCurrentPage({
        assetId: saved.asset_id,
        assetUrl: saved.url,
        natW: saved.width,
        natH: saved.height,
        maxWidthFrac: 0.28,
      });
    } else {
      placeImageOnCurrentPage({
        dataUrl,
        natW: width,
        natH: height,
        maxWidthFrac: 0.28,
      });
    }
  };

  const handlePlaceNewStamp = async (
    dataUrl: string,
    width: number,
    height: number,
    saveToLibrary: boolean,
    name: string,
    angleDeg: number,
  ) => {
    if (saveToLibrary) {
      const saved = await createAsset("image", name, dataUrl);
      setAssets((prev) => [saved, ...prev]);
      placeImageOnCurrentPage({
        assetId: saved.asset_id,
        assetUrl: saved.url,
        natW: saved.width,
        natH: saved.height,
        maxWidthFrac: 0.28,
        opacity: 0.9,
        angleDeg,
      });
    } else {
      placeImageOnCurrentPage({
        dataUrl,
        natW: width,
        natH: height,
        maxWidthFrac: 0.28,
        opacity: 0.9,
        angleDeg,
      });
    }
  };

  const handlePlaceSavedAsset = (asset: AssetItem) => {
    placeImageOnCurrentPage({
      assetId: asset.asset_id,
      assetUrl: asset.url,
      natW: asset.width,
      natH: asset.height,
      maxWidthFrac: asset.kind === "signature" ? 0.28 : 0.34,
    });
  };

  const handleDeleteAsset = async (assetId: string) => {
    await deleteAsset(assetId);
    setAssets((prev) => prev.filter((a) => a.asset_id !== assetId));
  };

  const handleDevLogin = async (
    email: string,
    name: string,
    captchaToken?: string | null,
  ) => {
    const res = await devLogin(email, name, captchaToken);
    setDevAuthToken(res.token);
    setUser(res.user);
    if (!doc) {
      setView("dashboard");
      updateUrlParams(null, null, "dashboard");
    }
    await refreshWorkspace(true);
  };

  const handleSignOut = async () => {
    await signOutEverywhere();
    const me = await fetchCurrentUser().catch(() => null);
    setUser(me);
    setDoc(null);
    setBlocks([]);
    setSavedDocs([]);
    setFolders([]);
    setAssets([]);
    setCurrentFolderId(null);
    setSelectedId(null);
    setSelectedOverlayId(null);
    resetHistory(EMPTY_SNAPSHOT);
    setView("landing");
    updateUrlParams(null, null, "landing");
  };

  const handleCreateFolder = async (name: string, parentId: string | null) => {
    setError(null);
    try {
      const created = await createFolder(name, parentId);
      setFolders((prev) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name)),
      );
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to create folder.",
      );
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
      setError(
        err instanceof Error ? err.message : "Failed to rename folder.",
      );
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    setError(null);
    try {
      const target = folders.find((f) => f.folder_id === folderId);
      const fallbackParent = target?.parent_id ?? null;
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
      if (currentFolderId === folderId) {
        setCurrentFolderId(fallbackParent);
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to delete folder.",
      );
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

  const handleToggleShare = async (nextShared: boolean) => {
    if (!doc) return;
    const res = await setDocumentShare(doc.doc_id, nextShared);
    setDocMeta((m) => ({
      ...m,
      isShared: res.is_shared,
      shareToken: res.share_token ?? null,
    }));
    void refreshWorkspace();
  };

  const handleDeleteSavedDoc = async (docId: string) => {
    await deleteDocument(docId);
    setSavedDocs((prev) => prev.filter((d) => d.doc_id !== docId));
    void fetchStorageUsage()
      .then(setStorageUsage)
      .catch(() => {});
    if (doc?.doc_id === docId) {
      setDoc(null);
      setBlocks([]);
      setSelectedId(null);
      setSelectedOverlayId(null);
      resetHistory(EMPTY_SNAPSHOT);
      updateUrlParams(null, null);
    }
  };

  const commitRuns = (block: TextBlock, runs: TextRun[]) => {
    const nextEdit = runsToEdit(block, runs);
    const existing = editsMap[block.id] ?? null;

    if (!nextEdit) {
      if (!existing) return;
      pushEdits((prev) => {
        const copy = { ...prev };
        delete copy[block.id];
        return copy;
      });
      return;
    }

    if (existing && JSON.stringify(existing) === JSON.stringify(nextEdit)) {
      return;
    }

    pushEdits((prev) => ({
      ...prev,
      [block.id]: nextEdit,
    }));
  };

  const syncDomFromRuns = (
    block: TextBlock,
    nextRuns: TextRun[],
    restoreRange: SelectionRange | null,
  ) => {
    draftRunsRef.current = nextRuns;
    setDraftRuns(nextRuns);
    const el = editorRef.current;
    if (!el) return;
    const wasFocused = document.activeElement === el;
    renderRunsIntoDom(el, nextRuns, block, zoom);
    if (wasFocused && restoreRange) {
      const len = runsToPlainText(nextRuns).length;
      const s = Math.min(restoreRange.start, len);
      const e = Math.min(restoreRange.end, len);
      setSelectionOffsets(el, s, e);
      selectionRangeRef.current = { start: s, end: e };
      setSelectionRange({ start: s, end: e });
    }
  };

  const selectBlock = (block: TextBlock) => {
    if (selectedId === block.id) return;
    if (selectedBlock && selectedBlock.id !== block.id) {
      skippedBlurBlockIdRef.current = selectedBlock.id;
      commitRuns(selectedBlock, draftRunsRef.current);
    } else if (skippedBlurBlockIdRef.current === block.id) {
      skippedBlurBlockIdRef.current = null;
    }
    setSelectedOverlayId(null);
    const initial = getInitialRuns(block, editsMap[block.id] ?? null);
    draftRunsRef.current = initial;
    setDraftRuns(initial);
    selectionRangeRef.current = null;
    setSelectionRange(null);
    setSelectedId(block.id);
  };

  const updateSelectedStyle = (patch: Partial<TextRunStyle>) => {
    if (!selectedBlock) return;
    const range =
      (editorRef.current ? getSelectionOffsets(editorRef.current) : null) ??
      selectionRangeRef.current;
    const nextRuns = applyStyleToRange(draftRunsRef.current, range, patch);
    syncDomFromRuns(selectedBlock, nextRuns, range);
    commitRuns(selectedBlock, nextRuns);
  };

  const transformSelectedCase = (mode: "upper" | "lower" | "title") => {
    if (!selectedBlock) return;
    const range =
      (editorRef.current ? getSelectionOffsets(editorRef.current) : null) ??
      selectionRangeRef.current;
    const nextRuns = transformCaseInRange(draftRunsRef.current, range, mode);
    syncDomFromRuns(selectedBlock, nextRuns, range);
    commitRuns(selectedBlock, nextRuns);
  };

  const revertSelected = () => {
    if (!selectedBlock) return;
    const original = getInitialRuns(selectedBlock, null);
    const len = runsToPlainText(original).length;
    syncDomFromRuns(selectedBlock, original, { start: len, end: len });
    pushEdits((prev) => {
      if (!prev[selectedBlock.id]) return prev;
      const copy = { ...prev };
      delete copy[selectedBlock.id];
      return copy;
    });
  };

  const handleCreateWhiteout = (bbox: [number, number, number, number]) => {
    const overlay: WhiteoutOverlay = {
      id: makeOverlayId("wo"),
      kind: "whiteout",
      page_index: pageIndex,
      bbox,
      fill_hex: "#ffffff",
      shape: "rect",
    };
    pushOverlays((prev) => [...prev, overlay]);
    setSelectedOverlayId(overlay.id);
    setToolMode("select");
  };

  const handleUpdateOverlay = (
    id: string,
    patch: Partial<WhiteoutOverlay> | Partial<ImageOverlay>,
  ) => {
    pushOverlays((prev) =>
      prev.map((o) => (o.id === id ? ({ ...o, ...patch } as PageOverlay) : o)),
    );
  };

  const handleDuplicateOverlay = (overlay: PageOverlay) => {
    const offset = 14;
    const [x0, y0, x1, y1] = overlay.bbox;
    const copy: PageOverlay = {
      ...overlay,
      id: makeOverlayId(overlay.kind === "whiteout" ? "wo" : "img"),
      bbox: [
        +(x0 + offset).toFixed(2),
        +(y0 + offset).toFixed(2),
        +(x1 + offset).toFixed(2),
        +(y1 + offset).toFixed(2),
      ],
    };
    pushOverlays((prev) => [...prev, copy]);
    setSelectedOverlayId(copy.id);
  };

  const handleStartCrop = (overlay: ImageOverlay) => {
    setSelectedOverlayId(overlay.id);
    setCroppingOverlayId(overlay.id);
    setDraftCrop(overlay.crop ?? [0, 0, 1, 1]);
  };

  const handleApplyCrop = () => {
    if (!croppingOverlayId || !draftCrop) return;
    const target = pageOverlays.find(
      (o): o is ImageOverlay =>
        o.id === croppingOverlayId && o.kind === "image",
    );
    if (target) {
      const patch = computeCroppedPatch(target, draftCrop);
      handleUpdateOverlay(target.id, patch);
    }
    setCroppingOverlayId(null);
    setDraftCrop(null);
  };

  const handleResetCrop = () => {
    setDraftCrop([0, 0, 1, 1]);
  };

  const handleCancelCrop = () => {
    setCroppingOverlayId(null);
    setDraftCrop(null);
  };

  const handleDeleteOverlay = (id: string) => {
    if (croppingOverlayId === id) {
      setCroppingOverlayId(null);
      setDraftCrop(null);
    }
    setSelectedOverlayId(null);
    pushOverlays((prev) => prev.filter((o) => o.id !== id));
  };

  const activeRangeStyle = useMemo(() => {
    if (!selectedBlock) return null;
    return getActiveStyleForRange(selectedBlock, draftRuns, selectionRange);
  }, [selectedBlock, draftRuns, selectionRange]);

  const selectedCharCount = useMemo(() => {
    if (!selectionRange) return 0;
    return Math.max(0, selectionRange.end - selectionRange.start);
  }, [selectionRange]);

  const isImageDoc = Boolean(doc && isImageFilename(doc.filename));

  const handleExport = async (format?: "pdf" | "png") => {
    if (!doc || exporting) return;
    const targetFormat = format ?? (isImageDoc ? "png" : "pdf");
    setExporting(true);
    setBusy(
      targetFormat === "png"
        ? "Exporting edited image..."
        : "Exporting edited PDF...",
    );
    setError(null);
    try {
      const stem = stripFileExtension(doc.filename, "document");
      const blob =
        targetFormat === "png"
          ? await exportEditedImage(
              doc.doc_id,
              pageIndex,
              pageEdits,
              pageOverlays,
              200,
              activeShareToken,
            )
          : await exportEditedPdf(
              doc.doc_id,
              allEdits,
              allOverlays,
              activeShareToken,
            );
      triggerDownload(blob, `${stem}-edited.${targetFormat}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setExporting(false);
      setBusy(null);
    }
  };
  handleExportRef.current = () => handleExport();

  const isSignedIn = Boolean(
    user &&
      user.provider !== "guest" &&
      user.id !== "guest" &&
      !user.id.startsWith("gst_"),
  );

  return (
    <TooltipProvider delayDuration={250}>
      <div
        className="app-shell flex min-h-screen flex-col bg-background text-foreground"
        onMouseDown={(e) => {
          const target = e.target as HTMLElement;
          if (
            target.closest(".inline-editor") ||
            target.closest(".inspector-bar") ||
            target.closest("[data-inspector-portal]") ||
            target.closest(".text-hitbox") ||
            target.closest(".pdf-overlay") ||
            target.closest("[data-whiteout-draw-layer]")
          ) {
            return;
          }
          if (selectedBlock) {
            skippedBlurBlockIdRef.current = selectedBlock.id;
            commitRuns(selectedBlock, draftRunsRef.current);
            setSelectedId(null);
          }
          if (croppingOverlayId && draftCrop) {
            handleApplyCrop();
          }
          if (selectedOverlayId) {
            setSelectedOverlayId(null);
          }
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
            const targetFolder = uploadTargetFolderRef.current;
            uploadTargetFolderRef.current = null;
            if (files.length > 0) void handleUploadFiles(files, targetFolder);
            e.target.value = "";
          }}
        />

        {/* Top Studio Navigation Bar — shown in editor / document loading views */}
        {(doc || docLoading) && (
          <header className="sticky top-0 z-20 grid h-14 grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-border bg-background/95 px-3 backdrop-blur-md sm:gap-4 sm:px-4">
          {/* Left: Brand + Grouped Document Menu */}
          <div className="flex min-w-0 items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={openDashboard}
                  className="flex shrink-0 cursor-pointer items-center gap-2 rounded-md transition-opacity hover:opacity-85"
                >
                  <BrandLogo size={26} />
                  {!doc && (
                    <span className="text-sm font-semibold tracking-tight text-foreground">
                      {BRAND_NAME}
                    </span>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent>Back to Dashboard</TooltipContent>
            </Tooltip>

            {docLoading && !doc ? (
              <Skeleton className="h-6 w-36 rounded-md" />
            ) : !doc ? (
              workspaceLoading ? (
                <Skeleton className="h-7 w-24 rounded-md" />
              ) : (
                savedDocs.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Saved documents"
                    className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      void refreshWorkspace();
                      setDocsOpen(true);
                    }}
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                    <span>My Docs</span>
                    <Badge
                      variant="secondary"
                      className="px-1.5 py-0 text-[10px]"
                    >
                      {savedDocs.length}
                    </Badge>
                  </Button>
                )
              )
            ) : (
              <>
                <Popover open={docMenuOpen} onOpenChange={setDocMenuOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-label="Document menu"
                      className="flex min-w-0 cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-left transition-colors hover:bg-accent"
                    >
                      <span
                        className="max-w-[180px] truncate text-xs font-semibold text-foreground"
                        title={doc.filename}
                      >
                        {doc.filename}
                      </span>
                      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-64 p-2">
                    <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                      <span
                        className="truncate text-xs font-semibold text-foreground"
                        title={doc.filename}
                      >
                        {doc.filename}
                      </span>
                      {currentPage && (
                        <Badge
                          variant={
                            currentPage.kind === "native" ? "native" : "scanned"
                          }
                          className="shrink-0 text-[10px] tracking-wider uppercase"
                        >
                          {currentPage.kind}
                        </Badge>
                      )}
                    </div>
                    <div className="px-2 pb-1.5 text-[11px] text-muted-foreground">
                      {doc.page_count} page{doc.page_count === 1 ? "" : "s"} · v
                      {docMeta.version}
                      {docMeta.updatedBy ? ` · ${docMeta.updatedBy}` : ""}
                    </div>
                    <Separator className="my-1" />
                    <div className="flex flex-col gap-0.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 justify-between px-2 text-xs font-normal"
                        onClick={() => {
                          setDocMenuOpen(false);
                          void persistCurrentState();
                        }}
                      >
                        <span className="flex items-center gap-2">
                          <Save className="h-3.5 w-3.5 text-muted-foreground" />
                          Save session
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          ⌘S
                        </span>
                      </Button>

                      {!docMeta.isOwner && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 justify-start gap-2 px-2 text-xs font-normal"
                          onClick={() => {
                            setDocMenuOpen(false);
                            void loadSavedDocument(
                              doc.doc_id,
                              activeShareToken,
                            );
                          }}
                        >
                          <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
                          Reload latest changes
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 justify-between px-2 text-xs font-normal"
                        onClick={() => {
                          setDocMenuOpen(false);
                          void refreshWorkspace();
                          setDocsOpen(true);
                        }}
                      >
                        <span className="flex items-center gap-2">
                          <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
                          Saved documents
                        </span>
                        <Badge
                          variant="secondary"
                          className="px-1.5 py-0 text-[10px]"
                        >
                          {savedDocs.length}
                        </Badge>
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 justify-start gap-2 px-2 text-xs font-normal"
                        onClick={() => {
                          setDocMenuOpen(false);
                          fileInputRef.current?.click();
                        }}
                      >
                        <Upload className="h-3.5 w-3.5 text-muted-foreground" />
                        Open another PDF or image
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 justify-start gap-2 px-2 text-xs font-normal"
                        onClick={() => {
                          setDocMenuOpen(false);
                          void handleExport(isImageDoc ? "pdf" : "png");
                        }}
                      >
                        <Download className="h-3.5 w-3.5 text-muted-foreground" />
                        {isImageDoc ? "Export as PDF" : "Export page as PNG"}
                      </Button>

                      <Separator className="my-1" />

                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 justify-between px-2 text-xs font-normal"
                        onClick={() => {
                          setDocMenuOpen(false);
                          setShortcutsOpen(true);
                        }}
                      >
                        <span className="flex items-center gap-2">
                          <Keyboard className="h-3.5 w-3.5 text-muted-foreground" />
                          Keyboard shortcuts
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          ?
                        </span>
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Minimal inline save status indicator */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => void persistCurrentState()}
                      className="hidden cursor-pointer items-center gap-1 rounded-full px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:flex"
                    >
                      {saveStatus === "saving" ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>Saving</span>
                        </>
                      ) : saveStatus === "saved" ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-600" />
                          <span>Saved</span>
                        </>
                      ) : (
                        <>
                          <Cloud className="h-3 w-3" />
                          <span>Save</span>
                        </>
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Save session (⌘S)</TooltipContent>
                </Tooltip>
              </>
            )}
          </div>

          {/* Center: Focused Primary Editing Tools Only */}
          <div className="flex items-center justify-center gap-2">
            {docLoading && !doc ? (
              <Skeleton className="h-8 w-72 rounded-lg" />
            ) : doc && (
              <>
                <div
                  className="flex items-center gap-0.5 rounded-lg border bg-muted/40 p-0.5"
                  role="group"
                  aria-label="Editor tools"
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={toolMode === "select" ? "default" : "ghost"}
                        size="sm"
                        aria-label="Select and edit text"
                        aria-pressed={toolMode === "select"}
                        className="h-7 gap-1.5 rounded-md px-2.5 text-xs"
                        onClick={() => setToolMode("select")}
                      >
                        <MousePointer2 className="h-3.5 w-3.5" />
                        <span>Select</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Select & edit text (V)</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={toolMode === "whiteout" ? "default" : "ghost"}
                        size="sm"
                        aria-label="Whiteout tool"
                        aria-pressed={toolMode === "whiteout"}
                        className="h-7 gap-1.5 rounded-md px-2.5 text-xs"
                        onClick={() => {
                          if (selectedBlock) {
                            skippedBlurBlockIdRef.current = selectedBlock.id;
                            commitRuns(selectedBlock, draftRunsRef.current);
                            setSelectedId(null);
                          }
                          setSelectedOverlayId(null);
                          setToolMode((m) =>
                            m === "whiteout" ? "select" : "whiteout",
                          );
                        }}
                      >
                        <Eraser className="h-3.5 w-3.5" />
                        <span>Whiteout</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Whiteout draw tool (W)</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Signature pad"
                        className="h-7 gap-1.5 rounded-md px-2.5 text-xs"
                        onClick={() => setSignOpen(true)}
                      >
                        <PenTool className="h-3.5 w-3.5" />
                        <span>Sign</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Signature pad (G)</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Add image"
                        className="h-7 gap-1.5 rounded-md px-2.5 text-xs"
                        onClick={() => setImageOpen(true)}
                      >
                        <ImagePlus className="h-3.5 w-3.5" />
                        <span>Image</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Add image / watermark (I)</TooltipContent>
                  </Tooltip>
                </div>

                <div className="hidden items-center gap-0.5 sm:flex">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Undo"
                        disabled={!canUndo}
                        onClick={undo}
                      >
                        <Undo2 className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Undo (⌘Z)</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Redo"
                        disabled={!canRedo}
                        onClick={redo}
                      >
                        <Redo2 className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Redo (⇧⌘Z)</TooltipContent>
                  </Tooltip>
                </div>
              </>
            )}
          </div>

          {/* Right: Share, Export & Account */}
          <div className="flex items-center justify-end gap-2">
            {docLoading && !doc ? (
              <Skeleton className="h-8 w-28 rounded-md" />
            ) : !doc ? (
              <Button
                variant="outline"
                size="default"
                className="hidden sm:inline-flex"
                onClick={() => {
                  if (captchaRequired && !uploadCaptchaToken) {
                    setError(
                      "Please complete the human verification check below before uploading.",
                    );
                    return;
                  }
                  fileInputRef.current?.click();
                }}
              >
                <Upload className="h-3.5 w-3.5" />
                <span>Upload file</span>
              </Button>
            ) : (
              <>
                {docMeta.isOwner && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={docMeta.isShared ? "secondary" : "ghost"}
                        size="default"
                        aria-label="Share document"
                        onClick={() => setShareOpen(true)}
                      >
                        <Share2 className="h-3.5 w-3.5" />
                        <span className="hidden md:inline">
                          {docMeta.isShared ? "Shared" : "Share"}
                        </span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Share edit link</TooltipContent>
                  </Tooltip>
                )}

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="default"
                      size="default"
                      disabled={exporting}
                      className="btn-primary"
                      onClick={() => void handleExport()}
                    >
                      {exporting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Download className="h-3.5 w-3.5" />
                      )}
                      <span>
                        {exporting
                          ? "Exporting..."
                          : `Export ${isImageDoc ? "PNG" : "PDF"}${totalChanges > 0 ? ` (${totalChanges})` : ""}`}
                      </span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Export edited {isImageDoc ? "image" : "PDF"} (⌘E)
                  </TooltipContent>
                </Tooltip>
              </>
            )}

            {/* Account / OAuth Sign In (skeleton while auth session resolves) */}
            {authLoading ? (
              <Skeleton
                data-auth-skeleton="true"
                className="h-8 w-20 rounded-full"
              />
            ) : isSignedIn && user ? (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label="Account menu"
                    className="h-8 gap-1.5 rounded-full pr-2.5 pl-1.5"
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                      {(user.name || user.email).slice(0, 1).toUpperCase()}
                    </span>
                    <span className="hidden max-w-[80px] truncate text-xs font-medium xl:inline">
                      {user.name}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-56 p-3">
                  <div className="space-y-0.5">
                    <div className="text-xs font-semibold text-foreground">
                      {user.name}
                    </div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {user.email}
                    </div>
                  </div>
                  <Separator className="my-2.5" />
                  <div className="flex flex-col gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="justify-start"
                      onClick={() => setAuthOpen(true)}
                    >
                      <UserIcon className="h-3.5 w-3.5" />
                      Switch account
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="justify-start text-destructive hover:bg-destructive/15 hover:text-destructive"
                      onClick={() => void handleSignOut()}
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Sign out
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            ) : (
              <Button
                variant="outline"
                size="default"
                aria-label="Sign in"
                onClick={() => setAuthOpen(true)}
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Sign in</span>
              </Button>
            )}
          </div>
        </header>
        )}

        {/* Editor Error Banner (landing page renders its own dark-themed banner) */}
        {error && (doc || docLoading) && (
          <div className="flex items-center justify-between gap-3 border-b border-destructive/30 bg-destructive/12 px-4 py-2 text-xs text-[#f7d8d2]">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
              <span>{error}</span>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Dismiss error"
              className="h-6 w-6 text-[#f7d8d2] hover:bg-destructive/20 hover:text-white"
              onClick={() => setError(null)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {/* Floating Contextual Inspector: Text Block, Overlay, or Whiteout Mode Hint */}
        {selectedBlock && activeRangeStyle && (
          <InspectorBar
            inspectorRef={inspectorRef}
            selectedBlock={selectedBlock}
            selectedEdit={selectedEdit}
            overrideFonts={overrideFonts}
            activeBold={activeRangeStyle.bold}
            activeItalic={activeRangeStyle.italic}
            activeUnderline={activeRangeStyle.underline}
            activeStrike={activeRangeStyle.strikethrough}
            activeColor={activeRangeStyle.colorHex}
            activeHighlight={activeRangeStyle.highlightHex}
            activeFamilyOverride={activeRangeStyle.fontFamilyOverride}
            activeSizePt={activeRangeStyle.fontSizePt}
            selectedCharCount={selectedCharCount}
            onPointerDownInside={markInspectorPointerDown}
            onUpdateStyle={updateSelectedStyle}
            onTransformCase={transformSelectedCase}
            onRevert={revertSelected}
            onDismiss={() => {
              skippedBlurBlockIdRef.current = selectedBlock.id;
              setSelectedId(null);
            }}
          />
        )}

        {!selectedBlock && selectedOverlay && (
          <OverlayInspectorBar
            overlay={selectedOverlay}
            isCropping={croppingOverlayId === selectedOverlay.id}
            onStartCrop={() => {
              if (selectedOverlay.kind === "image") {
                handleStartCrop(selectedOverlay);
              }
            }}
            onApplyCrop={handleApplyCrop}
            onResetCrop={handleResetCrop}
            onCancelCrop={handleCancelCrop}
            onUpdate={(patch) => handleUpdateOverlay(selectedOverlay.id, patch)}
            onDuplicate={() => handleDuplicateOverlay(selectedOverlay)}
            onDelete={() => handleDeleteOverlay(selectedOverlay.id)}
          />
        )}

        {!selectedBlock && !selectedOverlay && toolMode === "whiteout" && (
          <div className="fixed top-[66px] left-1/2 z-30 flex w-max -translate-x-1/2 items-center gap-2 rounded-full border border-input bg-popover px-3.5 py-1.5 text-xs font-medium text-foreground shadow-xl">
            <Eraser className="h-3.5 w-3.5 text-[#7170ff]" />
            <span>Click and drag anywhere on the page to white out</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px]"
              onClick={() => setToolMode("select")}
            >
              Cancel
            </Button>
          </div>
        )}

        {/* Workspace Canvas or Landing Page */}
        <main
          className={cn(
            "relative flex flex-1 flex-col",
            doc || docLoading
              ? "studio-grid items-center overflow-auto px-5 pt-16 pb-20"
              : "bg-[#08090a]",
          )}
        >
          {docLoading ? (
            <div
              data-doc-skeleton="true"
              className="flex flex-col items-center gap-4"
            >
              <div className="relative flex w-[min(740px,92vw)] aspect-[612/792] flex-col gap-5 rounded-md border border-border bg-card p-12 shadow-[0_24px_70px_-20px_rgba(0,0,0,0.8)]">
                <Skeleton className="h-7 w-2/5" />
                <div className="space-y-2.5 pt-2">
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="h-3.5 w-11/12" />
                  <Skeleton className="h-3.5 w-4/5" />
                </div>
                <Skeleton className="mt-2 h-28 w-full rounded-lg" />
                <div className="space-y-2.5 pt-2">
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="h-3.5 w-5/6" />
                  <Skeleton className="h-3.5 w-3/4" />
                </div>
                <div className="mt-auto grid grid-cols-2 gap-6 pt-6">
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-10 w-full rounded-md" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-10 w-full rounded-md" />
                  </div>
                </div>

                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="flex items-center gap-2 rounded-full border border-input bg-popover/95 px-4 py-2 text-xs font-medium text-foreground shadow-xl">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-[#7170ff]" />
                    <span>{busy || "Loading document..."}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : !doc ? (
            view === "dashboard" ? (
              <Suspense
                fallback={
                  <div className="flex h-dvh w-full items-center justify-center bg-[#0a0a0b] text-xs text-[#8a8f98]">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin text-[#7170ff]" />
                    Loading workspace...
                  </div>
                }
              >
                <DashboardPage
                  documents={savedDocs}
                  folders={folders}
                  storageUsage={storageUsage}
                  loading={workspaceLoading}
                  authLoading={authLoading}
                  isSignedIn={isSignedIn}
                  user={user}
                  uploadLimits={uploadLimits}
                  currentFolderId={currentFolderId}
                  onSelectFolder={setCurrentFolderId}
                  onOpenDocument={(docId) => void loadSavedDocument(docId)}
                  onChooseFile={(folderId) => {
                    uploadTargetFolderRef.current = folderId;
                    fileInputRef.current?.click();
                  }}
                  onUploadFiles={(files, folderId) =>
                    void handleUploadFiles(files, folderId)
                  }
                  onDeleteDocument={handleDeleteSavedDoc}
                  onMoveDocument={handleMoveDocToFolder}
                  onCreateFolder={handleCreateFolder}
                  onRenameFolder={handleRenameFolder}
                  onDeleteFolder={handleDeleteFolder}
                  onRefresh={() => void refreshWorkspace(true)}
                  onOpenAuth={() => setAuthOpen(true)}
                  onSignOut={() => void handleSignOut()}
                  onOpenShortcuts={() => setShortcutsOpen(true)}
                  onGoHome={goToLanding}
                  error={error}
                  onDismissError={() => setError(null)}
                />
              </Suspense>
            ) : (
              <LandingPage
                uploadLimits={uploadLimits}
                captchaRequired={captchaRequired}
                turnstileSiteKey={authConfig?.turnstile_site_key ?? ""}
                uploadCaptchaToken={uploadCaptchaToken}
                uploadCaptchaResetKey={uploadCaptchaResetKey}
                onCaptchaToken={setUploadCaptchaToken}
                onChooseFile={() => {
                  if (captchaRequired && !uploadCaptchaToken) {
                    setError(
                      "Please complete the human verification check below before uploading.",
                    );
                    return;
                  }
                  uploadTargetFolderRef.current = null;
                  fileInputRef.current?.click();
                }}
                onUploadFiles={(files) => void handleUploadFiles(files, null)}
                authLoading={authLoading}
                isSignedIn={isSignedIn}
                user={user}
                onOpenAuth={() => setAuthOpen(true)}
                onOpenDashboard={openDashboard}
                onSignOut={() => void handleSignOut()}
                onOpenShortcuts={() => setShortcutsOpen(true)}
                onOpenLegal={(tab) => setLegalTab(tab)}
                error={error}
                onDismissError={() => setError(null)}
              />
            )
          ) : (
            <div className="flex flex-col items-center gap-4">
              {currentPage && (
                <div
                  className="page-canvas relative overflow-visible rounded-sm bg-white shadow-[0_24px_70px_-16px_rgba(0,0,0,0.85)] ring-1 ring-white/10"
                  style={{
                    width: currentPage.width_pt * zoom,
                    height: currentPage.height_pt * zoom,
                  }}
                >
                  {activePreview && (
                    <img
                      className={cn(
                        "page-image block h-full w-full rounded-sm select-none",
                        !isCanvasReady && "opacity-0",
                      )}
                      src={activePreview.url}
                      alt={`Page ${pageIndex + 1}`}
                      draggable={false}
                      onLoad={() => {
                        setPreview((prev) =>
                          prev && prev.url === activePreview.url
                            ? { ...prev, loaded: true }
                            : prev,
                        );
                      }}
                    />
                  )}

                  {!isCanvasReady && (
                    <div
                      data-page-skeleton="true"
                      className="absolute inset-0 flex h-full w-full flex-col gap-5 rounded-sm bg-card p-12"
                    >
                      <Skeleton className="h-7 w-2/5" />
                      <div className="space-y-2.5 pt-2">
                        <Skeleton className="h-3.5 w-full" />
                        <Skeleton className="h-3.5 w-11/12" />
                        <Skeleton className="h-3.5 w-4/5" />
                      </div>
                      <Skeleton className="mt-2 h-28 w-full rounded-lg" />
                      <div className="space-y-2.5 pt-2">
                        <Skeleton className="h-3.5 w-full" />
                        <Skeleton className="h-3.5 w-5/6" />
                      </div>
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <div className="flex items-center gap-2 rounded-full border border-input bg-popover/95 px-4 py-2 text-xs font-medium text-foreground shadow-xl">
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-[#7170ff]" />
                          <span>{busy || "Rendering page..."}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {isCanvasReady &&
                    pageBlocks.map((block) => {
                    const [x0, y0, x1, y1] = block.bbox;
                    const isSelected = block.id === selectedId;
                    const isEdited = Boolean(editsMap[block.id]);

                    const boxStyle: React.CSSProperties = {
                      left: x0 * zoom,
                      top: y0 * zoom,
                      width: Math.max((x1 - x0) * zoom, 12),
                      height: Math.max((y1 - y0) * zoom, 12),
                    };

                    if (isSelected) {
                      const fallbackStyle =
                        draftRuns.length > 0 ? extractStyle(draftRuns[0]) : {};
                      const editorBg = editorBackgroundForRuns(
                        block,
                        draftRuns,
                      );

                      return (
                        <div
                          key={block.id}
                          ref={editorRef}
                          role="textbox"
                          aria-label="Edit text block"
                          contentEditable
                          suppressContentEditableWarning
                          spellCheck={false}
                          tabIndex={0}
                          className="inline-editor"
                          style={{
                            left: boxStyle.left,
                            top: boxStyle.top,
                            minWidth: Math.max((x1 - x0) * zoom + 24, 90),
                            minHeight: boxStyle.height,
                            fontSize: block.style.font_size_pt * zoom,
                            fontFamily: cssFontStack(
                              block.style.font_family,
                              block.style.serif,
                              block.style.mono,
                            ),
                            color: block.style.color_hex,
                            backgroundColor: editorBg,
                          }}
                          onInput={(e) => {
                            const nextRuns = parseRunsFromDom(
                              e.currentTarget,
                              fallbackStyle,
                            );
                            draftRunsRef.current = nextRuns;
                            setDraftRuns(nextRuns);
                            const offsets = getSelectionOffsets(
                              e.currentTarget,
                            );
                            if (offsets) {
                              selectionRangeRef.current = offsets;
                              setSelectionRange(offsets);
                            }
                          }}
                          onPaste={(e) => {
                            e.preventDefault();
                            const text = e.clipboardData
                              .getData("text/plain")
                              .replace(/\r?\n/g, " ");
                            document.execCommand("insertText", false, text);
                          }}
                          onBlur={(e) => {
                            if (skippedBlurBlockIdRef.current === block.id) {
                              skippedBlurBlockIdRef.current = null;
                              return;
                            }
                            commitRuns(block, draftRunsRef.current);
                            const nextEl =
                              e.relatedTarget instanceof Element
                                ? e.relatedTarget
                                : null;
                            const movingToInspector =
                              inspectorPointerDownRef.current ||
                              Boolean(
                                nextEl &&
                                  (inspectorRef.current?.contains(nextEl) ||
                                    nextEl.closest("[data-inspector-portal]")),
                              );
                            if (!movingToInspector) {
                              setSelectedId(null);
                            }
                          }}
                          onKeyDown={(e) => {
                            if ((e.metaKey || e.ctrlKey) && !e.shiftKey) {
                              const k = e.key.toLowerCase();
                              if (k === "b") {
                                e.preventDefault();
                                updateSelectedStyle({
                                  bold_override: !(
                                    activeRangeStyle?.bold ?? false
                                  ),
                                });
                                return;
                              }
                              if (k === "i") {
                                e.preventDefault();
                                updateSelectedStyle({
                                  italic_override: !(
                                    activeRangeStyle?.italic ?? false
                                  ),
                                });
                                return;
                              }
                              if (k === "u") {
                                e.preventDefault();
                                updateSelectedStyle({
                                  underline: !(
                                    activeRangeStyle?.underline ?? false
                                  ),
                                });
                                return;
                              }
                            }
                            if (
                              (e.metaKey || e.ctrlKey) &&
                              e.shiftKey &&
                              e.key.toLowerCase() === "x"
                            ) {
                              e.preventDefault();
                              updateSelectedStyle({
                                strikethrough: !(
                                  activeRangeStyle?.strikethrough ?? false
                                ),
                              });
                              return;
                            }
                            if (e.key === "Enter") {
                              e.preventDefault();
                              skippedBlurBlockIdRef.current = block.id;
                              commitRuns(block, draftRunsRef.current);
                              setSelectedId(null);
                            } else if (e.key === "Escape") {
                              e.preventDefault();
                              skippedBlurBlockIdRef.current = block.id;
                              const restored = getInitialRuns(
                                block,
                                editsMap[block.id] ?? null,
                              );
                              draftRunsRef.current = restored;
                              setDraftRuns(restored);
                              setSelectedId(null);
                            }
                          }}
                        />
                      );
                    }

                    return (
                      <button
                        key={block.id}
                        type="button"
                        title={`${block.style.original_font_name} (${block.style.font_size_pt}pt)`}
                        className={cn(
                          "text-hitbox",
                          showBoxes && "hitbox-visible",
                          showBoxes && isEdited && "hitbox-edited",
                        )}
                        style={boxStyle}
                        onMouseDown={(e) => {
                          if (e.button !== 0 || toolMode === "whiteout") return;
                          e.preventDefault();
                          selectBlock(block);
                        }}
                        onClick={() => {
                          if (toolMode === "whiteout") return;
                          selectBlock(block);
                        }}
                      />
                    );
                  })}

                  {/* Interactive Whiteout & Image/Signature Overlay Layer (synced with canvas render) */}
                  {isCanvasReady && (
                    <OverlayLayer
                      overlays={pageOverlays}
                      pageWidthPt={currentPage.width_pt}
                      pageHeightPt={currentPage.height_pt}
                      zoom={zoom}
                      toolMode={toolMode}
                      showBoxes={showBoxes}
                      selectedOverlayId={selectedOverlayId}
                      croppingOverlayId={croppingOverlayId}
                      draftCrop={draftCrop}
                      onSelectOverlay={(id) => {
                        if (croppingOverlayId && croppingOverlayId !== id) {
                          handleApplyCrop();
                        }
                        if (selectedBlock) {
                          skippedBlurBlockIdRef.current = selectedBlock.id;
                          commitRuns(selectedBlock, draftRunsRef.current);
                          setSelectedId(null);
                        }
                        setSelectedOverlayId(id);
                      }}
                      onStartCrop={handleStartCrop}
                      onChangeDraftCrop={setDraftCrop}
                      onCreateWhiteout={handleCreateWhiteout}
                      onCommitBbox={(id, bbox) =>
                        handleUpdateOverlay(id, { bbox })
                      }
                      onCommitAngle={(id, angleDeg) =>
                        handleUpdateOverlay(id, { angle_deg: angleDeg })
                      }
                    />
                  )}
                </div>
              )}

              {/* Subtle helper hint below page when no edits yet */}
              {totalChanges === 0 && !selectedBlock && !busy && (
                <div className="flex items-center gap-1.5 rounded-full border border-border bg-card/90 px-3 py-1 text-[11px] text-muted-foreground shadow-sm">
                  <Sparkles className="h-3 w-3 text-[#7170ff]" />
                  <span>
                    Click text to edit, use Whiteout to cover sections, Sign to
                    draw/save a signature, or Image for watermarks
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Floating Bottom Canvas View Bar: Show Boxes + Zoom + Page Pager */}
          {doc && (
            <div className="fixed bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-input bg-popover px-2.5 py-1 shadow-[0_14px_40px_-10px_rgba(0,0,0,0.8)]">
              <label className="toggle flex cursor-pointer items-center gap-1.5 px-1 text-xs font-medium text-foreground/90">
                {showBoxes ? (
                  <Eye className="h-3.5 w-3.5 text-[#7170ff]" />
                ) : (
                  <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <span>Boxes</span>
                <Switch
                  checked={showBoxes}
                  onCheckedChange={setShowBoxes}
                  aria-label="Show text boxes"
                />
              </label>

              <Separator orientation="vertical" className="h-4" />

              <div className="flex items-center gap-0.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Zoom out"
                      className="h-7 w-7 rounded-full"
                      onClick={() =>
                        setZoom((z) => Math.max(0.6, +(z - 0.15).toFixed(2)))
                      }
                    >
                      <ZoomOut className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Zoom out (-)</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setZoom(1.25)}
                      className="min-w-[44px] cursor-pointer rounded-full px-1.5 py-0.5 text-center text-xs font-medium text-foreground/90 tabular-nums transition-colors hover:bg-accent"
                    >
                      {Math.round(zoom * 100)}%
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Reset zoom (0)</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Zoom in"
                      className="h-7 w-7 rounded-full"
                      onClick={() =>
                        setZoom((z) => Math.min(2.4, +(z + 0.15).toFixed(2)))
                      }
                    >
                      <ZoomIn className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Zoom in (+)</TooltipContent>
                </Tooltip>
              </div>

              {doc.page_count > 1 && (
                <>
                  <Separator orientation="vertical" className="h-4" />
                  <div className="flex items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Previous page"
                      className="h-7 w-7 rounded-full"
                      disabled={pageIndex === 0}
                      onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="px-1.5 text-xs font-medium text-foreground/90 tabular-nums">
                      {pageIndex + 1} / {doc.page_count}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Next page"
                      className="h-7 w-7 rounded-full"
                      disabled={pageIndex >= doc.page_count - 1}
                      onClick={() =>
                        setPageIndex((i) => Math.min(doc.page_count - 1, i + 1))
                      }
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              )}

              <Separator orientation="vertical" className="h-4" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Keyboard shortcuts"
                    className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
                    onClick={() => setShortcutsOpen(true)}
                  >
                    <Keyboard className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Keyboard shortcuts (?)</TooltipContent>
              </Tooltip>
            </div>
          )}

          {/* Floating Busy Status Toast (hidden when centered document/page skeleton is already showing) */}
          {busy && !docLoading && (!doc || isCanvasReady) && (
            <div className="pointer-events-none fixed right-5 bottom-5 z-30 flex items-center gap-2 rounded-full border border-input bg-popover px-3.5 py-2 text-xs font-medium text-foreground shadow-xl">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#7170ff]" />
              <span>{busy}</span>
            </div>
          )}
        </main>

        {/* Modals: Auth, Signature Pad, Image Library, Stamp Studio, Saved Documents, Share, Legal */}
        <AuthDialog
          open={authOpen}
          onOpenChange={setAuthOpen}
          authConfig={authConfig}
          onOAuthLogin={(provider) => {
            if (!authConfig) return;
            const started = startAppwriteOAuth(provider, authConfig);
            if (!started) {
              setError(
                "Social sign-in is currently unavailable. Please try again later.",
              );
            }
          }}
          onDevLogin={handleDevLogin}
          onOpenLegal={(tab) => {
            setAuthOpen(false);
            setLegalTab(tab);
          }}
        />

        <Suspense fallback={null}>
          {signOpen && (
            <SignaturePadDialog
              open={signOpen}
              onOpenChange={setSignOpen}
              savedSignatures={savedSignatures}
              loading={workspaceLoading}
              onPlaceNewSignature={handlePlaceNewSignature}
              onPlaceSavedSignature={handlePlaceSavedAsset}
              onDeleteSavedSignature={handleDeleteAsset}
            />
          )}

          {imageOpen && (
            <ImageLibraryDialog
              open={imageOpen}
              onOpenChange={setImageOpen}
              savedImages={savedImages}
              loading={workspaceLoading}
              limits={uploadLimits}
              onUploadAndPlace={handleUploadImageAssetAndPlace}
              onPlaceSavedImage={handlePlaceSavedAsset}
              onDeleteSavedImage={handleDeleteAsset}
              onOpenStampStudio={(opts) => {
                setStampSeed({
                  file: opts?.file ?? null,
                  imageUrl: opts?.asset?.url ?? null,
                  name: opts?.asset?.name ?? "",
                });
                setStampOpen(true);
              }}
            />
          )}

          {stampOpen && (
            <StampStudioDialog
              open={stampOpen}
              onOpenChange={setStampOpen}
              limits={uploadLimits}
              initialFile={stampSeed.file ?? null}
              initialImageUrl={stampSeed.imageUrl ?? null}
              initialName={stampSeed.name ?? ""}
              onSaveAndPlaceStamp={handlePlaceNewStamp}
            />
          )}

          {shortcutsOpen && (
            <ShortcutsDialog
              open={shortcutsOpen}
              onOpenChange={setShortcutsOpen}
            />
          )}

          {legalTab !== null && (
            <LegalDialog
              open={true}
              tab={legalTab}
              onTabChange={setLegalTab}
              onOpenChange={(open) => {
                if (!open) setLegalTab(null);
              }}
            />
          )}
        </Suspense>

        <DocumentsDialog
          open={docsOpen}
          onOpenChange={setDocsOpen}
          documents={savedDocs}
          loading={workspaceLoading}
          activeDocId={doc?.doc_id ?? null}
          onOpenDocument={(id) => loadSavedDocument(id, null)}
          onDeleteDocument={handleDeleteSavedDoc}
        />

        {doc && (
          <ShareDialog
            open={shareOpen}
            onOpenChange={setShareOpen}
            docId={doc.doc_id}
            filename={doc.filename}
            isShared={docMeta.isShared}
            shareToken={docMeta.shareToken}
            onToggleShare={handleToggleShare}
          />
        )}

        <UploadQueueToast
          items={uploadQueue}
          onOpenDocument={(docId) => void loadSavedDocument(docId)}
          onDismiss={() => setUploadQueue([])}
        />

        {captchaRequired && authConfig?.turnstile_site_key && (
          <Dialog
            open={Boolean(pendingUploadFile)}
            onOpenChange={(open) => {
              if (!open) setPendingUploadFile(null);
            }}
          >
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Verify to upload file</DialogTitle>
                <DialogDescription>
                  Complete the verification check to upload{" "}
                  <span className="font-medium text-foreground">
                    {pendingUploadFile?.name}
                  </span>
                  .
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-center py-2">
                <TurnstileWidget
                  siteKey={authConfig.turnstile_site_key}
                  resetKey={uploadCaptchaResetKey}
                  onToken={(token) => {
                    if (token && pendingUploadFile) {
                      const folderId = uploadTargetFolderRef.current;
                      uploadTargetFolderRef.current = null;
                      void handleUpload(pendingUploadFile, token, folderId);
                    }
                  }}
                />
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </TooltipProvider>
  );
}
