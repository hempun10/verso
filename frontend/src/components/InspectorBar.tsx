import type { RefObject } from "react";
import {
  Bold,
  Check,
  Highlighter,
  Italic,
  Minus,
  Plus,
  RotateCcw,
  Strikethrough,
  Underline,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cssFontStack } from "@/lib/runs";
import { cn } from "@/lib/utils";
import type { TextBlock, TextEdit, TextRunStyle } from "@/types";

const AUTO_FONT_VALUE = "__auto__";
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

const TEXT_SWATCHES = [
  "#000000",
  "#222428",
  "#52525b",
  "#1e3a8a",
  "#2563eb",
  "#dc2626",
  "#15803d",
  "#b45309",
  "#7c3aed",
  "#ffffff",
];

const HIGHLIGHT_SWATCHES = [
  { hex: "#fff3a3", label: "Yellow" },
  { hex: "#bbf7d0", label: "Mint" },
  { hex: "#bae6fd", label: "Sky" },
  { hex: "#fbcfe8", label: "Pink" },
  { hex: "#ddd6fe", label: "Lavender" },
  { hex: "#fed7aa", label: "Peach" },
];

function formatFontLabel(family: string): string {
  return family.charAt(0).toUpperCase() + family.slice(1);
}

function formatFontSourceLabel(source: string): string {
  switch (source) {
    case "embedded":
      return "Embedded font";
    case "system_match":
      return "Matched font";
    case "ocr_matched":
      return "Detected text";
    case "fallback":
      return "Standard font";
    default:
      return "Matched";
  }
}

interface InspectorBarProps {
  inspectorRef: RefObject<HTMLDivElement | null>;
  selectedBlock: TextBlock;
  selectedEdit: TextEdit | null;
  overrideFonts: string[];
  activeBold: boolean;
  activeItalic: boolean;
  activeUnderline: boolean;
  activeStrike: boolean;
  activeColor: string;
  activeHighlight: string | null;
  activeFamilyOverride: string | null;
  activeSizePt: number;
  selectedCharCount: number;
  onPointerDownInside: () => void;
  onUpdateStyle: (patch: Partial<TextRunStyle>) => void;
  onTransformCase: (mode: "upper" | "lower" | "title") => void;
  onRevert: () => void;
  onDismiss: () => void;
}

export function InspectorBar({
  inspectorRef,
  selectedBlock,
  selectedEdit,
  overrideFonts,
  activeBold,
  activeItalic,
  activeUnderline,
  activeStrike,
  activeColor,
  activeHighlight,
  activeFamilyOverride,
  activeSizePt,
  selectedCharCount,
  onPointerDownInside,
  onUpdateStyle,
  onTransformCase,
  onRevert,
  onDismiss,
}: InspectorBarProps) {
  const nudgeSize = (delta: number) => {
    const next = Math.min(144, Math.max(6, +(activeSizePt + delta).toFixed(1)));
    onUpdateStyle({ font_size_pt_override: next });
  };

  return (
    <div
      ref={inspectorRef}
      className="inspector-bar fixed top-[66px] left-1/2 z-30 flex w-max max-w-[calc(100vw-24px)] -translate-x-1/2 flex-wrap items-center gap-1.5 rounded-xl border border-input bg-popover px-2.5 py-1.5 shadow-[0_14px_40px_-10px_rgba(0,0,0,0.75)]"
      onMouseDownCapture={(e) => {
        onPointerDownInside();
        const target = e.target as HTMLElement;
        // Keep inline editor focused (and text selection intact) when clicking formatting buttons.
        if (target.closest("button") && !target.closest("[data-allow-focus]")) {
          e.preventDefault();
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          onDismiss();
        }
      }}
    >
      {/* Font provenance / selection scope badge */}
      <div className="flex items-center gap-1.5 pr-0.5">
        <span
          className="max-w-[140px] truncate text-xs font-medium text-foreground"
          title={selectedBlock.style.original_font_name}
        >
          {selectedBlock.kind === "native"
            ? selectedBlock.style.original_font_name
            : `${selectedBlock.style.font_family} (${Math.round(
                selectedBlock.style.confidence * 100,
              )}%)`}
        </span>
        {selectedCharCount > 0 ? (
          <Badge
            variant="default"
            className="px-1.5 py-0 text-[10px] font-medium tabular-nums"
          >
            {selectedCharCount} selected
          </Badge>
        ) : (
          <Badge
            variant="secondary"
            className="px-1.5 py-0 text-[10px] font-medium"
          >
            {formatFontSourceLabel(selectedBlock.style.font_source)}
          </Badge>
        )}
      </div>

      <Separator orientation="vertical" className="mx-0.5 h-5" />

      {/* Formatting toggles: B I U S */}
      <div
        className="flex items-center gap-0.5 rounded-lg bg-accent p-0.5"
        role="group"
        aria-label="Text formatting"
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="icon-sm"
              variant={activeBold ? "default" : "ghost"}
              aria-label="Bold"
              aria-pressed={activeBold}
              className={cn(
                "fmt-btn h-6 w-6 rounded-md",
                activeBold && "fmt-active shadow-xs",
              )}
              onClick={() => onUpdateStyle({ bold_override: !activeBold })}
            >
              <Bold className="h-3.5 w-3.5" strokeWidth={2.4} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Bold (⌘B)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="icon-sm"
              variant={activeItalic ? "default" : "ghost"}
              aria-label="Italic"
              aria-pressed={activeItalic}
              className={cn(
                "fmt-btn h-6 w-6 rounded-md",
                activeItalic && "fmt-active shadow-xs",
              )}
              onClick={() => onUpdateStyle({ italic_override: !activeItalic })}
            >
              <Italic className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Italic (⌘I)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="icon-sm"
              variant={activeUnderline ? "default" : "ghost"}
              aria-label="Underline"
              aria-pressed={activeUnderline}
              className={cn(
                "fmt-btn h-6 w-6 rounded-md",
                activeUnderline && "fmt-active shadow-xs",
              )}
              onClick={() => onUpdateStyle({ underline: !activeUnderline })}
            >
              <Underline className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Underline (⌘U)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="icon-sm"
              variant={activeStrike ? "default" : "ghost"}
              aria-label="Strikethrough"
              aria-pressed={activeStrike}
              className={cn(
                "fmt-btn h-6 w-6 rounded-md",
                activeStrike && "fmt-active shadow-xs",
              )}
              onClick={() => onUpdateStyle({ strikethrough: !activeStrike })}
            >
              <Strikethrough className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Strikethrough (⇧⌘X)</TooltipContent>
        </Tooltip>
      </div>

      {/* Case transforms: AA Aa aa */}
      <div
        className="flex items-center gap-0.5 rounded-lg bg-accent p-0.5"
        role="group"
        aria-label="Case transform"
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="h-6 w-6 rounded-md text-[11px] font-semibold"
              onClick={() => onTransformCase("upper")}
            >
              AA
            </Button>
          </TooltipTrigger>
          <TooltipContent>UPPERCASE</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="h-6 w-6 rounded-md text-[11px] font-semibold"
              onClick={() => onTransformCase("title")}
            >
              Aa
            </Button>
          </TooltipTrigger>
          <TooltipContent>Title Case</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="h-6 w-6 rounded-md text-[11px] font-semibold"
              onClick={() => onTransformCase("lower")}
            >
              aa
            </Button>
          </TooltipTrigger>
          <TooltipContent>lowercase</TooltipContent>
        </Tooltip>
      </div>

      <Separator orientation="vertical" className="mx-0.5 h-5" />

      {/* shadcn Font family Select with live font previews */}
      <Select
        value={activeFamilyOverride ?? AUTO_FONT_VALUE}
        onValueChange={(val) =>
          onUpdateStyle({
            font_family_override: val === AUTO_FONT_VALUE ? null : val,
          })
        }
      >
        <SelectTrigger
          aria-label="Font family"
          data-allow-focus="true"
          className="w-[144px]"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent onMouseDownCapture={() => onPointerDownInside()}>
          <SelectItem value={AUTO_FONT_VALUE}>
            Auto ({formatFontLabel(selectedBlock.style.font_family)})
          </SelectItem>
          {overrideFonts.map((f) => (
            <SelectItem key={f} value={f}>
              <span
                style={{
                  fontFamily: cssFontStack(
                    f,
                    f === "times" || f === "georgia",
                    f === "courier",
                  ),
                }}
              >
                {formatFontLabel(f)}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Font size stepper + shadcn Input */}
      <div className="flex items-center rounded-md border border-input bg-background shadow-xs">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Decrease font size"
              className="h-7 w-6 rounded-r-none border-r border-input/70"
              onClick={() => nudgeSize(-0.5)}
            >
              <Minus className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Decrease size</TooltipContent>
        </Tooltip>
        <Input
          type="number"
          aria-label="Font size (pt)"
          step={0.5}
          min={6}
          max={144}
          value={activeSizePt}
          onChange={(e) => {
            const val = Number(e.target.value);
            if (val > 0) onUpdateStyle({ font_size_pt_override: val });
          }}
          className="h-7 w-13 border-0 px-1.5 text-center text-xs shadow-none focus-visible:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Increase font size"
              className="h-7 w-6 rounded-l-none border-l border-input/70"
              onClick={() => nudgeSize(0.5)}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Increase size</TooltipContent>
        </Tooltip>
      </div>

      <Separator orientation="vertical" className="mx-0.5 h-5" />

      {/* Text color popover */}
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label="Text color"
                className="relative h-7 w-7 flex-col gap-0 px-0"
              >
                <span className="text-[11px] leading-none font-bold text-foreground">
                  A
                </span>
                <span
                  className="mt-0.5 h-1 w-4 rounded-full ring-1 ring-white/25"
                  style={{ backgroundColor: activeColor }}
                />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Text color</TooltipContent>
        </Tooltip>
        <PopoverContent
          className="w-56 p-3"
          onMouseDownCapture={() => onPointerDownInside()}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-foreground">
              Text color
            </span>
            <span className="font-mono text-[11px] text-muted-foreground uppercase">
              {activeColor}
            </span>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {TEXT_SWATCHES.map((hex) => {
              const isCurrent = activeColor.toLowerCase() === hex.toLowerCase();
              const isLight = hex === "#ffffff";
              return (
                <button
                  key={hex}
                  type="button"
                  title={hex}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onUpdateStyle({ color_hex_override: hex })}
                  className={cn(
                    "flex h-7 w-full cursor-pointer items-center justify-center rounded-md border transition-transform hover:scale-105",
                    isCurrent
                      ? "ring-2 ring-primary ring-offset-1"
                      : "border-black/15",
                  )}
                  style={{ backgroundColor: hex }}
                >
                  {isCurrent && (
                    <Check
                      className={cn(
                        "h-3.5 w-3.5",
                        isLight ? "text-zinc-900" : "text-white",
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
              title="Pick custom color"
              className="relative h-7 w-7 shrink-0 cursor-pointer overflow-hidden rounded-md border border-input shadow-xs"
              style={{ backgroundColor: activeColor }}
            >
              <input
                type="color"
                aria-label="Custom text color picker"
                value={HEX_RE.test(activeColor) ? activeColor : "#000000"}
                onChange={(e) =>
                  onUpdateStyle({ color_hex_override: e.target.value })
                }
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </label>
            <Input
              aria-label="Custom text color hex"
              value={activeColor}
              onChange={(e) => {
                const v = e.target.value.trim();
                if (HEX_RE.test(v)) onUpdateStyle({ color_hex_override: v });
              }}
              placeholder="#000000"
              className="h-7 font-mono text-xs uppercase"
            />
          </div>
        </PopoverContent>
      </Popover>

      {/* Highlight popover */}
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant={activeHighlight ? "secondary" : "outline"}
                size="icon-sm"
                aria-label="Highlight color"
                className="relative h-7 w-7 flex-col gap-0 px-0"
              >
                <Highlighter className="h-3.5 w-3.5 text-foreground" />
                <span
                  className="mt-0.5 h-1 w-4 rounded-full ring-1 ring-white/25"
                  style={{
                    backgroundColor: activeHighlight ?? "transparent",
                  }}
                />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Highlight</TooltipContent>
        </Tooltip>
        <PopoverContent
          className="w-56 p-3"
          onMouseDownCapture={() => onPointerDownInside()}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-foreground">
              Highlight
            </span>
            {activeHighlight && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onUpdateStyle({ highlight_hex: null })}
              >
                <X className="h-3 w-3" />
                Clear
              </Button>
            )}
          </div>
          <div className="grid grid-cols-6 gap-1.5">
            {HIGHLIGHT_SWATCHES.map(({ hex, label }) => {
              const isCurrent =
                activeHighlight?.toLowerCase() === hex.toLowerCase();
              return (
                <button
                  key={hex}
                  type="button"
                  title={label}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onUpdateStyle({ highlight_hex: hex })}
                  className={cn(
                    "flex h-7 w-full cursor-pointer items-center justify-center rounded-md border border-black/15 transition-transform hover:scale-105",
                    isCurrent && "ring-2 ring-primary ring-offset-1",
                  )}
                  style={{ backgroundColor: hex }}
                >
                  {isCurrent && <Check className="h-3.5 w-3.5 text-zinc-900" />}
                </button>
              );
            })}
          </div>
          <Separator className="my-2.5" />
          <div className="flex items-center gap-2">
            <label
              title="Pick custom highlight"
              className="relative h-7 w-7 shrink-0 cursor-pointer overflow-hidden rounded-md border border-input shadow-xs"
              style={{ backgroundColor: activeHighlight ?? "#fff3a3" }}
            >
              <input
                type="color"
                aria-label="Custom highlight color picker"
                value={
                  activeHighlight && HEX_RE.test(activeHighlight)
                    ? activeHighlight
                    : "#fff3a3"
                }
                onChange={(e) =>
                  onUpdateStyle({ highlight_hex: e.target.value })
                }
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </label>
            <Input
              aria-label="Custom highlight hex"
              value={activeHighlight ?? ""}
              placeholder="#fff3a3"
              onChange={(e) => {
                const v = e.target.value.trim();
                if (HEX_RE.test(v)) onUpdateStyle({ highlight_hex: v });
              }}
              className="h-7 font-mono text-xs uppercase"
            />
          </div>
        </PopoverContent>
      </Popover>

      {selectedEdit && (
        <>
          <Separator orientation="vertical" className="mx-0.5 h-5" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={onRevert}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Revert
              </Button>
            </TooltipTrigger>
            <TooltipContent>Revert block to original</TooltipContent>
          </Tooltip>
        </>
      )}
    </div>
  );
}
