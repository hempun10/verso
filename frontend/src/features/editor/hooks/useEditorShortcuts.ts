import { computeCroppedPatch, type CropBox } from "@/components/OverlayLayer";
import { useWindowKeyDown } from "@/hooks/useKeyboardShortcuts";
import { isEditableTarget } from "@/lib/dom";
import type {
  DocumentSummary,
  ImageOverlay,
  PageOverlay,
  PageInfo,
  ToolMode,
} from "@/types";
import { makeOverlayId } from "../types";

interface UseEditorShortcutsArgs {
  doc: DocumentSummary | null;
  currentPage: PageInfo | null;
  pageOverlays: PageOverlay[];
  anyDialogOpen: boolean;
  selectedOverlayId: string | null;
  croppingOverlayId: string | null;
  draftCrop: CropBox | null;
  toolMode: ToolMode;
  onPersist: () => void;
  onToggleShortcuts: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
  onPushOverlays: (updater: (prev: PageOverlay[]) => PageOverlay[]) => void;
  onSelectOverlay: (id: string | null) => void;
  onStartCrop: (id: string | null, crop: CropBox | null) => void;
  onSetToolMode: (updater: ToolMode | ((prev: ToolMode) => ToolMode)) => void;
  onSetZoom: (updater: number | ((prev: number) => number)) => void;
  onToggleBoxes: () => void;
  onOpenSign: () => void;
  onOpenImage: () => void;
  onSetPageIndex: (updater: (prev: number) => number) => void;
}

export function useEditorShortcuts({
  doc,
  currentPage,
  pageOverlays,
  anyDialogOpen,
  selectedOverlayId,
  croppingOverlayId,
  draftCrop,
  toolMode,
  onPersist,
  onToggleShortcuts,
  onUndo,
  onRedo,
  onExport,
  onPushOverlays,
  onSelectOverlay,
  onStartCrop,
  onSetToolMode,
  onSetZoom,
  onToggleBoxes,
  onOpenSign,
  onOpenImage,
  onSetPageIndex,
}: UseEditorShortcutsArgs) {
  useWindowKeyDown((e) => {
    const mod = e.metaKey || e.ctrlKey;
    const keyLower = e.key.toLowerCase();

    if (mod && keyLower === "s") {
      e.preventDefault();
      onPersist();
      return;
    }
    if (mod && e.key === "/") {
      e.preventDefault();
      onToggleShortcuts();
      return;
    }
    if (isEditableTarget(e.target)) return;

    if (e.key === "?" && !mod && !e.altKey) {
      e.preventDefault();
      onToggleShortcuts();
      return;
    }
    if (anyDialogOpen) return;

    if (mod && keyLower === "z") {
      e.preventDefault();
      if (e.shiftKey) onRedo();
      else onUndo();
      return;
    }
    if (e.ctrlKey && !e.metaKey && keyLower === "y") {
      e.preventDefault();
      onRedo();
      return;
    }
    if (!doc) return;

    if (mod && keyLower === "e") {
      e.preventDefault();
      onExport();
      return;
    }

    if (mod && keyLower === "d" && selectedOverlayId && !croppingOverlayId) {
      const targetOv = pageOverlays.find((o) => o.id === selectedOverlayId);
      if (targetOv) {
        e.preventDefault();
        const [x0, y0, x1, y1] = targetOv.bbox;
        const copy: PageOverlay = {
          ...targetOv,
          id: makeOverlayId(targetOv.kind === "whiteout" ? "wo" : "img"),
          bbox: [
            +(x0 + 14).toFixed(2),
            +(y0 + 14).toFixed(2),
            +(x1 + 14).toFixed(2),
            +(y1 + 14).toFixed(2),
          ],
        };
        onPushOverlays((prev) => [...prev, copy]);
        onSelectOverlay(copy.id);
      }
      return;
    }

    if (e.key === "Enter" && croppingOverlayId && draftCrop) {
      e.preventDefault();
      const targetOv = pageOverlays.find(
        (o): o is ImageOverlay =>
          o.id === croppingOverlayId && o.kind === "image",
      );
      if (targetOv) {
        const patch = computeCroppedPatch(targetOv, draftCrop);
        onPushOverlays((prev) =>
          prev.map((o) =>
            o.id === targetOv.id ? ({ ...o, ...patch } as PageOverlay) : o,
          ),
        );
      }
      onStartCrop(null, null);
      return;
    }

    if (e.key === "Escape") {
      if (croppingOverlayId) onStartCrop(null, null);
      else if (toolMode !== "select") onSetToolMode("select");
      else if (selectedOverlayId) onSelectOverlay(null);
      return;
    }

    if (
      (e.key === "Backspace" || e.key === "Delete") &&
      selectedOverlayId &&
      !croppingOverlayId
    ) {
      e.preventDefault();
      const delId = selectedOverlayId;
      onSelectOverlay(null);
      onPushOverlays((prev) => prev.filter((o) => o.id !== delId));
      return;
    }

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
        onPushOverlays((prev) =>
          prev.map((o) =>
            o.id === targetOv.id
              ? ({ ...o, bbox: nextBbox } as PageOverlay)
              : o,
          ),
        );
      }
      return;
    }

    if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      onSetZoom((z) => Math.min(2.4, +(z + 0.15).toFixed(2)));
      return;
    }
    if (e.key === "-") {
      e.preventDefault();
      onSetZoom((z) => Math.max(0.6, +(z - 0.15).toFixed(2)));
      return;
    }
    if (e.key === "0") {
      e.preventDefault();
      onSetZoom(1.25);
      return;
    }

    if (mod || e.altKey) return;

    if (keyLower === "v") {
      e.preventDefault();
      onSetToolMode("select");
    } else if (keyLower === "w") {
      e.preventDefault();
      onSelectOverlay(null);
      onStartCrop(null, null);
      onSetToolMode((m) => (m === "whiteout" ? "select" : "whiteout"));
    } else if (keyLower === "g") {
      e.preventDefault();
      onOpenSign();
    } else if (keyLower === "i") {
      e.preventDefault();
      onOpenImage();
    } else if (keyLower === "b") {
      e.preventDefault();
      onToggleBoxes();
    } else if (e.key === "[" || e.key === "PageUp") {
      if (doc.page_count > 1) {
        e.preventDefault();
        onSetPageIndex((i) => Math.max(0, i - 1));
      }
    } else if (e.key === "]" || e.key === "PageDown") {
      if (doc.page_count > 1) {
        e.preventDefault();
        onSetPageIndex((i) => Math.min(doc.page_count - 1, i + 1));
      }
    } else if (keyLower === "c" && selectedOverlayId && !croppingOverlayId) {
      const targetOv = pageOverlays.find(
        (o): o is ImageOverlay =>
          o.id === selectedOverlayId && o.kind === "image",
      );
      if (targetOv) {
        e.preventDefault();
        onStartCrop(targetOv.id, targetOv.crop ?? [0, 0, 1, 1]);
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
        onPushOverlays((prev) =>
          prev.map((o) =>
            o.id === targetOv.id
              ? ({ ...o, angle_deg: nextAngle } as PageOverlay)
              : o,
          ),
        );
      }
    }
  });
}
