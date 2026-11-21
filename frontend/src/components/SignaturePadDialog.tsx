import { useRef, useState } from "react";
import { Check, Eraser, Loader2, PenTool, Trash2, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cropCanvasToTrimmedPng } from "@/lib/canvas";
import { cn } from "@/lib/utils";
import type { AssetItem } from "@/types";

const INK_COLORS = [
  { hex: "#111827", label: "Black" },
  { hex: "#1e3a8a", label: "Navy" },
  { hex: "#1d4ed8", label: "Blue" },
];

const STROKE_WIDTHS = [
  { width: 2, label: "Thin" },
  { width: 3.2, label: "Medium" },
  { width: 4.8, label: "Bold" },
];

const TYPE_FONTS = [
  {
    id: "script",
    label: "Script",
    css: 'italic 46px "Snell Roundhand", "Brush Script MT", "Apple Chancery", cursive',
  },
  {
    id: "serif",
    label: "Classic",
    css: 'italic 40px Georgia, "Times New Roman", serif',
  },
  {
    id: "clean",
    label: "Modern",
    css: '500 italic 36px "Segoe Script", "Bradley Hand", cursive',
  },
];

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

function renderTypedSignaturePng(
  text: string,
  fontCss: string,
  color: string,
): { dataUrl: string; width: number; height: number } | null {
  const clean = text.trim();
  if (!clean) return null;
  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 220;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(2, 2);
  ctx.font = fontCss;
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.fillText(clean, 20, 55);
  return cropCanvasToTrimmedPng(canvas, 12);
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
  const [typeFontId, setTypeFontId] = useState(TYPE_FONTS[0].id);
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
    const ctx = canvas.getContext("2d");
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
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
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
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
    const midX = (last.x + pt.x) / 2;
    const midY = (last.y + pt.y) / 2;

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = strokeWidth * 2;
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.quadraticCurveTo(last.x, last.y, midX, midY);
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
    if (tab === "draw") {
      if (!canvasRef.current) return;
      result = cropCanvasToTrimmedPng(canvasRef.current, 12);
    } else if (tab === "type") {
      const font =
        TYPE_FONTS.find((f) => f.id === typeFontId) ?? TYPE_FONTS[0];
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
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const activeTypeFont =
    TYPE_FONTS.find((f) => f.id === typeFontId) ?? TYPE_FONTS[0];

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

          {/* Draw Tab */}
          <TabsContent value="draw" className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                {INK_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    title={c.label}
                    onClick={() => setInkColor(c.hex)}
                    className={cn(
                      "flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-black/15 transition-transform hover:scale-105",
                      inkColor === c.hex &&
                        "ring-2 ring-primary ring-offset-1",
                    )}
                    style={{ backgroundColor: c.hex }}
                  >
                    {inkColor === c.hex && (
                      <Check className="h-3 w-3 text-white" />
                    )}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1">
                {STROKE_WIDTHS.map((s) => (
                  <Button
                    key={s.label}
                    type="button"
                    size="sm"
                    variant={strokeWidth === s.width ? "secondary" : "ghost"}
                    className="h-6 px-2 text-[11px]"
                    onClick={() => setStrokeWidth(s.width)}
                  >
                    {s.label}
                  </Button>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-6 gap-1 px-2 text-[11px] text-muted-foreground"
                  onClick={clearCanvas}
                >
                  <Eraser className="h-3 w-3" />
                  Clear
                </Button>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-xl border-2 border-dashed border-input bg-white">
              <canvas
                ref={canvasRef}
                width={960}
                height={340}
                data-signature-canvas="true"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                className="h-[170px] w-full cursor-crosshair touch-none"
              />
              {!hasStrokes && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-zinc-500">
                  Sign here with your mouse, trackpad, or stylus
                </div>
              )}
              <div className="pointer-events-none absolute right-6 bottom-6 left-6 border-b border-zinc-300" />
            </div>
          </TabsContent>

          {/* Type Tab */}
          <TabsContent value="type" className="space-y-3">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Type your full name..."
                value={typedText}
                onChange={(e) => setTypedText(e.target.value)}
                className="h-9 text-sm"
              />
              <div className="flex items-center gap-1.5">
                {INK_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    title={c.label}
                    onClick={() => setInkColor(c.hex)}
                    className={cn(
                      "flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-black/15",
                      inkColor === c.hex &&
                        "ring-2 ring-primary ring-offset-1",
                    )}
                    style={{ backgroundColor: c.hex }}
                  >
                    {inkColor === c.hex && (
                      <Check className="h-3 w-3 text-white" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-1.5">
              {TYPE_FONTS.map((f) => (
                <Button
                  key={f.id}
                  type="button"
                  size="sm"
                  variant={typeFontId === f.id ? "default" : "outline"}
                  onClick={() => setTypeFontId(f.id)}
                >
                  {f.label}
                </Button>
              ))}
            </div>

            <div className="flex h-[130px] items-center justify-center rounded-xl border border-input bg-white px-6">
              {typedText.trim() ? (
                <span
                  style={{
                    font: activeTypeFont.css,
                    color: inkColor,
                  }}
                >
                  {typedText}
                </span>
              ) : (
                <span className="text-xs text-zinc-500">
                  Signature preview appears here
                </span>
              )}
            </div>
          </TabsContent>

          {/* Saved Signatures Tab */}
          <TabsContent value="saved">
            {loading && savedSignatures.length === 0 ? (
              <div className="grid grid-cols-2 gap-2.5">
                {[0, 1].map((i) => (
                  <div
                    key={i}
                    className="space-y-2 rounded-xl border border-border bg-secondary p-3"
                  >
                    <Skeleton className="h-16 w-full rounded-md" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                ))}
              </div>
            ) : savedSignatures.length === 0 ? (
              <EmptyState
                compact
                className="h-[170px]"
                title="No saved signatures yet"
                description='Draw or type a signature and keep "Save to library" checked to reuse it anytime.'
              />
            ) : (
              <div className="grid max-h-[240px] grid-cols-2 gap-2.5 overflow-y-auto pr-1">
                {savedSignatures.map((sig) => {
                  const isDeleting = deletingId === sig.asset_id;
                  return (
                    <div
                      key={sig.asset_id}
                      className="group relative flex flex-col items-center justify-between rounded-xl border border-border bg-secondary p-3 transition-colors hover:border-input"
                    >
                      <button
                        type="button"
                        className="flex h-16 w-full cursor-pointer items-center justify-center rounded-lg bg-white/95 px-2"
                        onClick={() => {
                          onPlaceSavedSignature(sig);
                          onOpenChange(false);
                        }}
                      >
                        <img
                          src={sig.url}
                          alt={sig.name}
                          className="max-h-14 max-w-full object-contain"
                        />
                      </button>
                      <div className="mt-2 flex w-full items-center justify-between gap-2 border-t border-border pt-1.5">
                        <span className="truncate text-[11px] font-medium text-foreground/90">
                          {sig.name}
                        </span>
                        <button
                          type="button"
                          disabled={isDeleting}
                          aria-label={`Delete ${sig.name}`}
                          className="cursor-pointer rounded p-1 text-muted-foreground hover:bg-destructive/15 hover:text-destructive disabled:opacity-50"
                          onClick={async () => {
                            setDeletingId(sig.asset_id);
                            try {
                              await onDeleteSavedSignature(sig.asset_id);
                            } finally {
                              setDeletingId(null);
                            }
                          }}
                        >
                          {isDeleting ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
                onClick={() => onOpenChange(false)}
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
