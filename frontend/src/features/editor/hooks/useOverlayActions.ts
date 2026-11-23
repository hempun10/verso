import { useCallback, useMemo, useState } from "react";
import { computeCroppedPatch, type CropBox } from "@/components/OverlayLayer";
import type {
  ImageOverlay,
  PageOverlay,
  ToolMode,
  WhiteoutOverlay,
} from "@/types";
import { makeOverlayId } from "../types";

interface UseOverlayActionsArgs {
  pageOverlays: PageOverlay[];
  pageIndex: number;
  pushOverlays: (updater: (prev: PageOverlay[]) => PageOverlay[]) => void;
  setToolMode: (mode: ToolMode) => void;
}

export function useOverlayActions({
  pageOverlays,
  pageIndex,
  pushOverlays,
  setToolMode,
}: UseOverlayActionsArgs) {
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(
    null,
  );
  const [croppingOverlayId, setCroppingOverlayId] = useState<string | null>(
    null,
  );
  const [draftCrop, setDraftCrop] = useState<CropBox | null>(null);

  const selectedOverlay = useMemo(
    () => pageOverlays.find((o) => o.id === selectedOverlayId) ?? null,
    [pageOverlays, selectedOverlayId],
  );

  const clearOverlaySelection = useCallback(() => {
    setSelectedOverlayId(null);
    setCroppingOverlayId(null);
    setDraftCrop(null);
  }, []);

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
    const [x0, y0, x1, y1] = overlay.bbox;
    const copy: PageOverlay = {
      ...overlay,
      id: makeOverlayId(overlay.kind === "whiteout" ? "wo" : "img"),
      bbox: [
        +(x0 + 14).toFixed(2),
        +(y0 + 14).toFixed(2),
        +(x1 + 14).toFixed(2),
        +(y1 + 14).toFixed(2),
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
      handleUpdateOverlay(target.id, computeCroppedPatch(target, draftCrop));
    }
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

  return {
    selectedOverlayId,
    setSelectedOverlayId,
    croppingOverlayId,
    setCroppingOverlayId,
    draftCrop,
    setDraftCrop,
    selectedOverlay,
    clearOverlaySelection,
    handleCreateWhiteout,
    handleUpdateOverlay,
    handleDuplicateOverlay,
    handleStartCrop,
    handleApplyCrop,
    handleResetCrop: () => setDraftCrop([0, 0, 1, 1]),
    handleCancelCrop: () => {
      setCroppingOverlayId(null);
      setDraftCrop(null);
    },
    handleDeleteOverlay,
  };
}
