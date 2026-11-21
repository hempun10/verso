import { Check, Eraser, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { AssetItem } from "@/types";

export const SIGNATURE_INK_COLORS = [
  { hex: "#111827", label: "Black" },
  { hex: "#1e3a8a", label: "Navy" },
  { hex: "#1d4ed8", label: "Blue" },
] as const;

export const SIGNATURE_STROKE_WIDTHS = [
  { width: 2, label: "Thin" },
  { width: 3.2, label: "Medium" },
  { width: 4.8, label: "Bold" },
] as const;

export const SIGNATURE_TYPE_FONTS = [
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
] as const;

function InkSwatches({
  inkColor,
  onSelect,
}: {
  inkColor: string;
  onSelect: (hex: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {SIGNATURE_INK_COLORS.map((c) => (
        <button
          key={c.hex}
          type="button"
          title={c.label}
          onClick={() => onSelect(c.hex)}
          className={cn(
            "flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-black/15 transition-transform hover:scale-105",
            inkColor === c.hex && "ring-2 ring-primary ring-offset-1",
          )}
          style={{ backgroundColor: c.hex }}
        >
          {inkColor === c.hex && <Check className="h-3 w-3 text-white" />}
        </button>
      ))}
    </div>
  );
}

interface DrawSignatureTabProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  inkColor: string;
  strokeWidth: number;
  hasStrokes: boolean;
  onInkColorChange: (hex: string) => void;
  onStrokeWidthChange: (w: number) => void;
  onClear: () => void;
  onPointerDown: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerUp: () => void;
}

export function DrawSignatureTab({
  canvasRef,
  inkColor,
  strokeWidth,
  hasStrokes,
  onInkColorChange,
  onStrokeWidthChange,
  onClear,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: DrawSignatureTabProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <InkSwatches inkColor={inkColor} onSelect={onInkColorChange} />
        <div className="flex items-center gap-1">
          {SIGNATURE_STROKE_WIDTHS.map((s) => (
            <Button
              key={s.label}
              type="button"
              size="sm"
              variant={strokeWidth === s.width ? "secondary" : "ghost"}
              className="h-6 px-2 text-[11px]"
              onClick={() => onStrokeWidthChange(s.width)}
            >
              {s.label}
            </Button>
          ))}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 gap-1 px-2 text-[11px] text-muted-foreground"
            onClick={onClear}
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
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="h-[170px] w-full cursor-crosshair touch-none"
        />
        {!hasStrokes && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-zinc-500">
            Sign here with your mouse, trackpad, or stylus
          </div>
        )}
        <div className="pointer-events-none absolute right-6 bottom-6 left-6 border-b border-zinc-300" />
      </div>
    </div>
  );
}

interface TypeSignatureTabProps {
  typedText: string;
  inkColor: string;
  typeFontId: string;
  onTypedTextChange: (text: string) => void;
  onInkColorChange: (hex: string) => void;
  onTypeFontChange: (id: string) => void;
}

export function TypeSignatureTab({
  typedText,
  inkColor,
  typeFontId,
  onTypedTextChange,
  onInkColorChange,
  onTypeFontChange,
}: TypeSignatureTabProps) {
  const activeTypeFont =
    SIGNATURE_TYPE_FONTS.find((f) => f.id === typeFontId) ??
    SIGNATURE_TYPE_FONTS[0];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Type your full name..."
          value={typedText}
          onChange={(e) => onTypedTextChange(e.target.value)}
          className="h-9 text-sm"
        />
        <InkSwatches inkColor={inkColor} onSelect={onInkColorChange} />
      </div>

      <div className="flex gap-1.5">
        {SIGNATURE_TYPE_FONTS.map((f) => (
          <Button
            key={f.id}
            type="button"
            size="sm"
            variant={typeFontId === f.id ? "default" : "outline"}
            onClick={() => onTypeFontChange(f.id)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      <div className="flex h-[130px] items-center justify-center rounded-xl border border-input bg-white px-6">
        {typedText.trim() ? (
          <span style={{ font: activeTypeFont.css, color: inkColor }}>
            {typedText}
          </span>
        ) : (
          <span className="text-xs text-zinc-500">
            Signature preview appears here
          </span>
        )}
      </div>
    </div>
  );
}

interface SavedSignaturesTabProps {
  savedSignatures: AssetItem[];
  loading: boolean;
  deletingId: string | null;
  onPlace: (asset: AssetItem) => void;
  onDelete: (assetId: string) => Promise<void>;
}

export function SavedSignaturesTab({
  savedSignatures,
  loading,
  deletingId,
  onPlace,
  onDelete,
}: SavedSignaturesTabProps) {
  if (loading && savedSignatures.length === 0) {
    return (
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
    );
  }
  if (savedSignatures.length === 0) {
    return (
      <EmptyState
        compact
        className="h-[170px]"
        title="No saved signatures yet"
        description='Draw or type a signature and keep "Save to library" checked to reuse it anytime.'
      />
    );
  }

  return (
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
              onClick={() => onPlace(sig)}
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
                onClick={() => void onDelete(sig.asset_id)}
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
  );
}
