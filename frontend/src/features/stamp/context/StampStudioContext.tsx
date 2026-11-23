import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { stripFileExtension, triggerDownload } from "@/lib/format";
import {
  exportStampPng,
  renderStampToCanvas,
  STAMP_INK_PRESETS,
  type StampConfig,
  type StampExtractMode,
} from "@/lib/stampRenderer";
import { validateImageFileClient } from "@/lib/validation";
import type { UploadLimits } from "@/types";
import { useStampExtraction } from "../hooks/useStampExtraction";

const DEFAULT_CONFIG: StampConfig = {
  template: "circle",
  borderStyle: "classic",
  inkColor: STAMP_INK_PRESETS[0].hex,
  topText: "OFFICE OF THE REGISTRAR",
  bottomText: "OFFICIAL SEAL",
  showStars: true,
  showDate: false,
  logoScale: 0.82,
  distress: 32,
  seed: 42,
};

export interface StampStudioContextValue {
  limits: UploadLimits;
  hasSource: boolean;
  sourceLabel: string;
  extractMode: StampExtractMode;
  setExtractMode: (m: StampExtractMode) => void;
  sensitivity: number;
  setSensitivity: (v: number) => void;
  removeInnerWhite: boolean;
  setRemoveInnerWhite: (v: boolean) => void;
  extracting: boolean;
  extractError: string | null;
  config: StampConfig;
  updateConfig: <K extends keyof StampConfig>(
    key: K,
    value: StampConfig[K],
  ) => void;
  placementTilt: number;
  setPlacementTilt: (deg: number) => void;
  saveToLibrary: boolean;
  setSaveToLibrary: (v: boolean) => void;
  stampName: string;
  setStampName: (name: string) => void;
  saving: boolean;
  canExport: boolean;
  onCanvasMount: (el: HTMLCanvasElement | null) => void;
  chooseFile: (file: File) => void;
  openFilePicker: () => void;
  clearSource: () => void;
  rerollGrain: () => void;
  downloadPng: () => void;
  placeStamp: () => Promise<void>;
}

const StampStudioContext = createContext<StampStudioContextValue | null>(null);

interface StampStudioProviderProps {
  open: boolean;
  limits: UploadLimits;
  initialFile: File | null;
  initialImageUrl: string | null;
  initialName: string;
  onSaveAndPlaceStamp: (
    dataUrl: string,
    width: number,
    height: number,
    saveToLibrary: boolean,
    name: string,
    angleDeg: number,
  ) => Promise<void>;
  onClose: () => void;
  children: ReactNode;
}

export function StampStudioProvider({
  open,
  limits,
  initialFile,
  initialImageUrl,
  initialName,
  onSaveAndPlaceStamp,
  onClose,
  children,
}: StampStudioProviderProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null);

  const [sourceBlob, setSourceBlob] = useState<Blob | null>(() => initialFile);
  const [sourceLabel, setSourceLabel] = useState<string>(() =>
    initialFile
      ? initialFile.name
      : initialImageUrl
        ? initialName || "Saved image"
        : "",
  );
  const [extractMode, setExtractMode] = useState<StampExtractMode>("ink");
  const [sensitivity, setSensitivity] = useState<number>(52);
  const [removeInnerWhite, setRemoveInnerWhite] = useState<boolean>(true);
  const [config, setConfig] = useState<StampConfig>(DEFAULT_CONFIG);
  const [placementTilt, setPlacementTilt] = useState<number>(-5);
  const [saveToLibrary, setSaveToLibrary] = useState<boolean>(true);
  const [stampName, setStampName] = useState<string>(() => {
    if (initialFile) {
      const base = stripFileExtension(initialFile.name, "");
      return base ? `${base} Stamp` : "Official Stamp";
    }
    return initialImageUrl && initialName
      ? `${initialName} Stamp`
      : "Official Stamp";
  });
  const [saving, setSaving] = useState<boolean>(false);

  const handleLoadedInitialBlob = useCallback((blob: Blob) => {
    setSourceBlob(blob);
  }, []);

  const { maskImg, setMaskImg, extracting, extractError, setExtractError } =
    useStampExtraction({
      open,
      initialFile,
      initialImageUrl,
      sourceBlob,
      extractMode,
      sensitivity,
      removeInnerWhite,
      onLoadedInitialBlob: handleLoadedInitialBlob,
    });

  useEffect(() => {
    if (!open || !canvasEl) return;
    renderStampToCanvas(canvasEl, maskImg, config);
  }, [open, canvasEl, maskImg, config]);

  const chooseFile = (file: File) => {
    setExtractError(null);
    const err = validateImageFileClient(file, limits);
    if (err) {
      setExtractError(err);
      return;
    }
    setSourceBlob(file);
    setSourceLabel(file.name);
    const base = stripFileExtension(file.name, "");
    if (base) setStampName(`${base} Stamp`);
  };

  const canExport = Boolean(
    maskImg ||
      (config.template !== "raw" &&
        (config.topText.trim() || config.bottomText.trim() || config.showDate)),
  );

  const downloadPng = () => {
    const exported = exportStampPng(maskImg, config);
    if (!exported) return;
    const slug = (stampName.trim() || "official-stamp")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-");
    triggerDownload(exported.dataUrl, `${slug}.png`);
  };

  const placeStamp = async () => {
    const exported = exportStampPng(maskImg, config);
    if (!exported) return;
    setSaving(true);
    setExtractError(null);
    try {
      await onSaveAndPlaceStamp(
        exported.dataUrl,
        exported.width,
        exported.height,
        saveToLibrary,
        stampName.trim() || "Official Stamp",
        placementTilt,
      );
      onClose();
    } catch (err: unknown) {
      setExtractError(
        err instanceof Error ? err.message : "Failed to save stamp.",
      );
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = <K extends keyof StampConfig>(
    key: K,
    value: StampConfig[K],
  ) => setConfig((prev) => ({ ...prev, [key]: value }));

  return (
    <StampStudioContext
      value={{
        limits,
        hasSource: Boolean(sourceBlob),
        sourceLabel,
        extractMode,
        setExtractMode,
        sensitivity,
        setSensitivity,
        removeInnerWhite,
        setRemoveInnerWhite,
        extracting,
        extractError,
        config,
        updateConfig,
        placementTilt,
        setPlacementTilt,
        saveToLibrary,
        setSaveToLibrary,
        stampName,
        setStampName,
        saving,
        canExport,
        onCanvasMount: setCanvasEl,
        chooseFile,
        openFilePicker: () => fileInputRef.current?.click(),
        clearSource: () => {
          setSourceBlob(null);
          setSourceLabel("");
          setMaskImg(null);
        },
        rerollGrain: () =>
          updateConfig("seed", Math.floor(Math.random() * 99999) + 1),
        downloadPng,
        placeStamp,
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={limits.allowed_image_types.join(",")}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) chooseFile(file);
          e.target.value = "";
        }}
      />
      {children}
    </StampStudioContext>
  );
}

export function useStampStudio(): StampStudioContextValue {
  const ctx = useContext(StampStudioContext);
  if (!ctx) {
    throw new Error("useStampStudio must be used within StampStudioProvider");
  }
  return ctx;
}
