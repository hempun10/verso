import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export interface ColorSwatch {
  hex: string;
  label?: string;
}

interface ColorSwatchPickerProps {
  title: string;
  value: string | null;
  fallbackPickerHex?: string;
  swatches: readonly ColorSwatch[];
  columns?: 5 | 6;
  allowClear?: boolean;
  preventFocusSteal?: boolean;
  onChange: (hex: string) => void;
  onClear?: () => void;
}

function isBrightHex(hex: string): boolean {
  const clean = hex.replace(/^#/, "");
  if (clean.length !== 6) return false;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 175;
}

/** Reusable swatch grid + custom color picker + hex input for popovers. */
export function ColorSwatchPicker({
  title,
  value,
  fallbackPickerHex = "#000000",
  swatches,
  columns = 6,
  allowClear = false,
  preventFocusSteal = false,
  onChange,
  onClear,
}: ColorSwatchPickerProps) {
  const safePickerHex =
    value && HEX_RE.test(value) ? value : fallbackPickerHex;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-foreground">{title}</span>
        {allowClear && value && onClear ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-label text-muted-foreground hover:text-foreground"
            onMouseDown={(e) => {
              if (preventFocusSteal) e.preventDefault();
            }}
            onClick={onClear}
          >
            <X className="h-3 w-3" />
            Clear
          </Button>
        ) : (
          <span className="font-mono text-label text-muted-foreground uppercase">
            {value ?? ""}
          </span>
        )}
      </div>

      <div
        className={cn(
          "grid gap-1.5",
          columns === 5 ? "grid-cols-5" : "grid-cols-6",
        )}
      >
        {swatches.map(({ hex, label }) => {
          const isCurrent = value?.toLowerCase() === hex.toLowerCase();
          return (
            <button
              key={hex}
              type="button"
              title={label ?? hex}
              onMouseDown={(e) => {
                if (preventFocusSteal) e.preventDefault();
              }}
              onClick={() => onChange(hex)}
              className={cn(
                "flex h-7 w-full cursor-pointer items-center justify-center rounded-md border transition-transform hover:scale-105",
                isCurrent
                  ? "ring-2 ring-primary ring-offset-1"
                  : "border-black/20",
              )}
              style={{ backgroundColor: hex }}
            >
              {isCurrent && (
                <Check
                  className={cn(
                    "h-3.5 w-3.5",
                    isBrightHex(hex) ? "text-zinc-900" : "text-white",
                  )}
                />
              )}
            </button>
          );
        })}
      </div>

      <Separator className="my-2.5" />

      <div className="flex items-center gap-2">
        <label
          title={`Pick custom ${title.toLowerCase()}`}
          className="relative h-7 w-7 shrink-0 cursor-pointer overflow-hidden rounded-md border border-input shadow-xs"
          style={{ backgroundColor: safePickerHex }}
        >
          <input
            type="color"
            aria-label={`Custom ${title.toLowerCase()} picker`}
            value={safePickerHex}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
        <Input
          aria-label={`Custom ${title.toLowerCase()} hex`}
          value={value ?? ""}
          placeholder={fallbackPickerHex}
          onChange={(e) => {
            const v = e.target.value.trim();
            if (HEX_RE.test(v)) onChange(v);
          }}
          className="h-7 font-mono text-xs uppercase"
        />
      </div>
    </div>
  );
}
