import { useCallback } from "react";
import { createAsset } from "@/api";
import { readFileAsDataUrl, stripFileExtension } from "@/lib/format";
import { validateImageFileClient } from "@/lib/validation";
import type {
  AssetItem,
  ImageOverlay,
  PageOverlay,
  PageInfo,
  ToolMode,
  UploadLimits,
} from "@/types";
import { makeOverlayId } from "./types";

interface UseAssetPlacementArgs {
  currentPage: PageInfo | null;
  pageIndex: number;
  uploadLimits: UploadLimits;
  pushOverlays: (updater: (prev: PageOverlay[]) => PageOverlay[]) => void;
  setAssets: React.Dispatch<React.SetStateAction<AssetItem[]>>;
  onPlacedOverlay: (overlayId: string) => void;
  onSetToolMode: (mode: ToolMode) => void;
}

export function useAssetPlacement({
  currentPage,
  pageIndex,
  uploadLimits,
  pushOverlays,
  setAssets,
  onPlacedOverlay,
  onSetToolMode,
}: UseAssetPlacementArgs) {
  const placeImageOnCurrentPage = useCallback(
    (opts: {
      assetId?: string | null;
      assetUrl?: string | null;
      dataUrl?: string | null;
      natW: number;
      natH: number;
      maxWidthFrac?: number;
      opacity?: number;
      angleDeg?: number;
    }) => {
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
      onSetToolMode("select");
      pushOverlays((prev) => [...prev, overlay]);
      onPlacedOverlay(overlay.id);
    },
    [currentPage, onPlacedOverlay, onSetToolMode, pageIndex, pushOverlays],
  );

  const handleUploadImageAssetAndPlace = async (file: File) => {
    const validationError = validateImageFileClient(file, uploadLimits);
    if (validationError) throw new Error(validationError);
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

  return {
    handleUploadImageAssetAndPlace,
    handlePlaceNewSignature,
    handlePlaceNewStamp,
    handlePlaceSavedAsset,
  };
}
