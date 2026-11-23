import { useRef, useState } from "react";
import { PenTool, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DrawSignatureTab,
  SavedSignaturesTab,
  SIGNATURE_TYPE_FONTS,
  TypeSignatureTab,
} from "@/features/signature/components/SignatureTabs";
import { renderTypedSignaturePng } from "@/features/signature/utils/renderSignature";
import { cropCanvasToTrimmedPng } from "@/lib/canvas";
import type { AssetItem } from "@/types";

interface SignaturePadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  savedSignatures: AssetItem[];
  loading?: boolean;
  onPlaceNewSignature: (
    dataUrl: string,
    width: number,
    height: number,
    saveToLibrary: boolean,
    name: string,
  ) => Promise<void>;
  onPlaceSavedSignature: (asset: AssetItem) => void;
  onDeleteSavedSignature: (assetId: string) => Promise<void>;
}

export function SignaturePadDialog({
  open,
  onOpenChange,
  savedSignatures,
  loading = false,
  onPlaceNewSignature,
  onPlaceSavedSignature,
  onDeleteSavedSignature,
}: SignaturePadDialogProps) {
  const [tab, setTab] = useState<string>("draw");
  const [inkColor, setInkColor] = useState("#111827");
  const [strokeWidth, setStrokeWidth] = useState(3.2);
  const [hasStrokes, setHasStrokes] = useState(false);
  const [typedText, setTypedText] = useState("");
  const [typeFontId, setTypeFontId] = useState<string>(
    SIGNATURE_TYPE_FONTS[0].id,
  );
  const [saveToLibrary, setSaveToLibrary] = useState(true);
  const [sigName, setSigName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastPtRef = useRef<{ x: number; y: number } | null>(null);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    setHasStrokes(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setHasStrokes(false);
      setSigName("");
    }
    onOpenChange(nextOpen);
  };

  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    canvas.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const pt = getCanvasPoint(e);
    lastPtRef.current = pt;

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = inkColor;
    ctx.fillStyle = inkColor;
    ctx.lineWidth = strokeWidth * 2;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, strokeWidth, 0, Math.PI * 2);
    ctx.fill();
    setHasStrokes(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const last = lastPtRef.current;
    if (!canvas || !ctx || !last) return;

    const pt = getCanvasPoint(e);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = strokeWidth * 2;
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.quadraticCurveTo(last.x, last.y, (last.x + pt.x) / 2, (last.y + pt.y) / 2);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
    lastPtRef.current = pt;
  };

  const handlePointerUp = () => {
    drawingRef.current = false;
    lastPtRef.current = null;
  };

  const handleInsertDrawnOrTyped = async () => {
    let result: { dataUrl: string; width: number; height: number } | null = null;
    if (tab === "draw" && canvasRef.current) {
      result = cropCanvasToTrimmedPng(canvasRef.current, 12);
    } else if (tab === "type") {
      const font =
        SIGNATURE_TYPE_FONTS.find((f) => f.id === typeFontId) ??
        SIGNATURE_TYPE_FONTS[0];
      result = renderTypedSignaturePng(typedText, font.css, inkColor);
    }
    if (!result) return;

    setSaving(true);
    try {
      const defaultName =
        sigName.trim() ||
        (tab === "type" && typedText.trim()
          ? typedText.trim()
          : `Signature ${savedSignatures.length + 1}`);
      await onPlaceNewSignature(
        result.dataUrl,
        result.width,
        result.height,
        saveToLibrary,
        defaultName,
      );
      handleOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSaved = async (assetId: string) => {
    setDeletingId(assetId);
    try {
      await onDeleteSavedSignature(assetId);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Signature Pad</DialogTitle>
          <DialogDescription>
            Draw or type a signature, save it to your account, and place it
            anywhere on the page.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="draw">
              <PenTool className="h-3.5 w-3.5" />
              Draw
            </TabsTrigger>
            <TabsTrigger value="type">
              <Type className="h-3.5 w-3.5" />
              Type
            </TabsTrigger>
            <TabsTrigger value="saved">
              Saved ({savedSignatures.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="draw">
            <DrawSignatureTab
              canvasRef={canvasRef}
              inkColor={inkColor}
              strokeWidth={strokeWidth}
              hasStrokes={hasStrokes}
              onInkColorChange={setInkColor}
              onStrokeWidthChange={setStrokeWidth}
              onClear={clearCanvas}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            />
          </TabsContent>

          <TabsContent value="type">
            <TypeSignatureTab
              typedText={typedText}
              inkColor={inkColor}
              typeFontId={typeFontId}
              onTypedTextChange={setTypedText}
              onInkColorChange={setInkColor}
              onTypeFontChange={setTypeFontId}
            />
          </TabsContent>

          <TabsContent value="saved">
            <SavedSignaturesTab
              savedSignatures={savedSignatures}
              loading={loading}
              deletingId={deletingId}
              onPlace={(sig) => {
                onPlaceSavedSignature(sig);
                handleOpenChange(false);
              }}
              onDelete={handleDeleteSaved}
            />
          </TabsContent>
        </Tabs>

        {tab !== "saved" && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
            <div className="flex items-center gap-2">
              <label className="flex cursor-pointer items-center gap-2 text-xs text-foreground/90">
                <Checkbox
                  checked={saveToLibrary}
                  onCheckedChange={(v) => setSaveToLibrary(v === true)}
                />
                <span>Save to library</span>
              </label>
              {saveToLibrary && (
                <Input
                  placeholder="Label (optional)"
                  value={sigName}
                  onChange={(e) => setSigName(e.target.value)}
                  className="h-7 w-36 text-xs"
                />
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={
                  saving ||
                  (tab === "draw" && !hasStrokes) ||
                  (tab === "type" && !typedText.trim())
                }
                onClick={() => void handleInsertDrawnOrTyped()}
              >
                {saving ? "Saving..." : "Place signature"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
