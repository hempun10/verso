import {
  Bold,
  Italic,
  Minus,
  Plus,
  Strikethrough,
  Underline,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import type { TextBlock, TextRunStyle } from "@/types";

const AUTO_FONT_VALUE = "__auto__";

function formatFontLabel(family: string): string {
  return family.charAt(0).toUpperCase() + family.slice(1);
}

interface TextStyleControlsProps {
  selectedBlock: TextBlock;
  overrideFonts: string[];
  activeBold: boolean;
  activeItalic: boolean;
  activeUnderline: boolean;
  activeStrike: boolean;
  activeFamilyOverride: string | null;
  activeSizePt: number;
  onPointerDownInside: () => void;
  onUpdateStyle: (patch: Partial<TextRunStyle>) => void;
  onTransformCase: (mode: "upper" | "lower" | "title") => void;
}

export function TextStyleControls({
  selectedBlock,
  overrideFonts,
  activeBold,
  activeItalic,
  activeUnderline,
  activeStrike,
  activeFamilyOverride,
  activeSizePt,
  onPointerDownInside,
  onUpdateStyle,
  onTransformCase,
}: TextStyleControlsProps) {
  const nudgeSize = (delta: number) => {
    const next = Math.min(144, Math.max(6, +(activeSizePt + delta).toFixed(1)));
    onUpdateStyle({ font_size_pt_override: next });
  };

  return (
    <>
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

      {/* Case transforms */}
      <div
        className="flex items-center gap-0.5 rounded-lg bg-accent p-0.5"
        role="group"
        aria-label="Case transform"
      >
        {(
          [
            ["upper", "AA", "UPPERCASE"],
            ["title", "Aa", "Title Case"],
            ["lower", "aa", "lowercase"],
          ] as const
        ).map(([mode, text, tip]) => (
          <Tooltip key={mode}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                className="h-6 w-6 rounded-md text-[11px] font-semibold"
                onClick={() => onTransformCase(mode)}
              >
                {text}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{tip}</TooltipContent>
          </Tooltip>
        ))}
      </div>

      <Separator orientation="vertical" className="mx-0.5 h-5" />

      {/* Font family Select */}
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

      {/* Font size stepper */}
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
    </>
  );
}
