import { Highlighter, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ColorSwatchPicker } from "@/components/ui/color-swatch-picker";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useEditor } from "@/features/editor/EditorContext";
import { TextStyleControls } from "@/features/editor/TextStyleControls";

const TEXT_SWATCHES = [
  { hex: "#000000" },
  { hex: "#222428" },
  { hex: "#52525b" },
  { hex: "#1e3a8a" },
  { hex: "#2563eb" },
  { hex: "#dc2626" },
  { hex: "#15803d" },
  { hex: "#b45309" },
  { hex: "#7c3aed" },
  { hex: "#ffffff" },
] as const;

const HIGHLIGHT_SWATCHES = [
  { hex: "#fff3a3", label: "Yellow" },
  { hex: "#bbf7d0", label: "Mint" },
  { hex: "#bae6fd", label: "Sky" },
  { hex: "#fbcfe8", label: "Pink" },
  { hex: "#ddd6fe", label: "Lavender" },
  { hex: "#fed7aa", label: "Peach" },
] as const;

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

export function InspectorBar() {
  const { actions } = useEditor();
  const { selectedBlock, selectedEdit, activeRangeStyle, selectedCharCount } =
    actions;

  if (!selectedBlock || !activeRangeStyle) return null;

  const { colorHex: activeColor, highlightHex: activeHighlight } =
    activeRangeStyle;

  return (
    <div
      ref={actions.inspectorRef}
      className="inspector-bar fixed top-[66px] left-1/2 z-30 flex w-max max-w-[calc(100vw-24px)] -translate-x-1/2 flex-wrap items-center gap-1.5 rounded-xl border border-input bg-popover px-2.5 py-1.5 shadow-[0_14px_40px_-10px_rgba(0,0,0,0.75)]"
      onMouseDownCapture={(e) => {
        actions.markInspectorPointerDown();
        const target = e.target as HTMLElement;
        if (target.closest("button") && !target.closest("[data-allow-focus]")) {
          e.preventDefault();
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          actions.skippedBlurBlockIdRef.current = selectedBlock.id;
          actions.setSelectedId(null);
        }
      }}
    >
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

      <TextStyleControls />

      <Separator orientation="vertical" className="mx-0.5 h-5" />

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
          onMouseDownCapture={() => actions.markInspectorPointerDown()}
        >
          <ColorSwatchPicker
            title="Text color"
            value={activeColor}
            fallbackPickerHex="#000000"
            swatches={TEXT_SWATCHES}
            columns={5}
            preventFocusSteal
            onChange={(hex) =>
              actions.updateSelectedStyle({ color_hex_override: hex })
            }
          />
        </PopoverContent>
      </Popover>

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
                  style={{ backgroundColor: activeHighlight ?? "transparent" }}
                />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Highlight</TooltipContent>
        </Tooltip>
        <PopoverContent
          className="w-56 p-3"
          onMouseDownCapture={() => actions.markInspectorPointerDown()}
        >
          <ColorSwatchPicker
            title="Highlight"
            value={activeHighlight}
            fallbackPickerHex="#fff3a3"
            swatches={HIGHLIGHT_SWATCHES}
            allowClear
            preventFocusSteal
            onChange={(hex) =>
              actions.updateSelectedStyle({ highlight_hex: hex })
            }
            onClear={() => actions.updateSelectedStyle({ highlight_hex: null })}
          />
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
                onClick={actions.revertSelected}
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
