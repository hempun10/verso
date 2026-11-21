import { Check } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  STAMP_INK_PRESETS,
  type StampBorderStyle,
  type StampConfig,
  type StampExtractMode,
  type StampTemplate,
} from "@/lib/stampRenderer";
import { cn } from "@/lib/utils";
import { StampExtractControls } from "./StampExtractControls";

const TEMPLATES: { id: StampTemplate; label: string }[] = [
  { id: "circle", label: "Circle Seal" },
  { id: "oval", label: "Oval Seal" },
  { id: "rect", label: "Box Stamp" },
  { id: "raw", label: "Logo Only" },
];

const BORDER_STYLES: { id: StampBorderStyle; label: string }[] = [
  { id: "classic", label: "Classic" },
  { id: "dotted", label: "Dotted" },
  { id: "notary", label: "Notary" },
];

function SliderField({
  label,
  valueText,
  min,
  max,
  value,
  onChange,
}: {
  label: string;
  valueText: string;
  min: number;
  max: number;
  value: number;
  onChange: (val: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono text-foreground tabular-nums">
          {valueText}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer accent-[#7170ff]"
      />
    </div>
  );
}

interface StampControlsPaneProps {
  hasSource: boolean;
  extractMode: StampExtractMode;
  sensitivity: number;
  removeInnerWhite: boolean;
  config: StampConfig;
  placementTilt: number;
  saveToLibrary: boolean;
  stampName: string;
  onExtractModeChange: (mode: StampExtractMode) => void;
  onSensitivityChange: (val: number) => void;
  onRemoveInnerWhiteChange: (val: boolean) => void;
  onUpdateConfig: <K extends keyof StampConfig>(
    key: K,
    value: StampConfig[K],
  ) => void;
  onPlacementTiltChange: (deg: number) => void;
  onSaveToLibraryChange: (val: boolean) => void;
  onStampNameChange: (name: string) => void;
}

export function StampControlsPane({
  hasSource,
  extractMode,
  sensitivity,
  removeInnerWhite,
  config,
  placementTilt,
  saveToLibrary,
  stampName,
  onExtractModeChange,
  onSensitivityChange,
  onRemoveInnerWhiteChange,
  onUpdateConfig,
  onPlacementTiltChange,
  onSaveToLibraryChange,
  onStampNameChange,
}: StampControlsPaneProps) {
  return (
    <div className="flex flex-col gap-4 overflow-y-auto p-5">
      {hasSource && (
        <StampExtractControls
          extractMode={extractMode}
          sensitivity={sensitivity}
          removeInnerWhite={removeInnerWhite}
          onExtractModeChange={onExtractModeChange}
          onSensitivityChange={onSensitivityChange}
          onRemoveInnerWhiteChange={onRemoveInnerWhiteChange}
        />
      )}

      <div className="space-y-2.5">
        <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          Seal Style &amp; Ink
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onUpdateConfig("template", t.id)}
              className={cn(
                "cursor-pointer rounded-lg border px-2 py-1.5 text-center text-[11px] font-medium transition-colors",
                config.template === t.id
                  ? "border-[#7170ff]/70 bg-[#7170ff]/18 text-foreground"
                  : "border-border bg-secondary text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {config.template !== "raw" && (
          <div className="grid grid-cols-3 gap-1.5">
            {BORDER_STYLES.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => onUpdateConfig("borderStyle", b.id)}
                className={cn(
                  "cursor-pointer rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
                  config.borderStyle === b.id
                    ? "border-input bg-[#232428] text-foreground"
                    : "border-border/60 bg-secondary/60 text-muted-foreground hover:text-foreground",
                )}
              >
                {b.label} Ring
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          {STAMP_INK_PRESETS.map((c) => {
            const active =
              config.inkColor.toLowerCase() === c.hex.toLowerCase();
            return (
              <button
                key={c.hex}
                type="button"
                title={c.label}
                onClick={() => onUpdateConfig("inkColor", c.hex)}
                className={cn(
                  "flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-2 transition-transform hover:scale-105",
                  active
                    ? "border-white ring-2 ring-[#7170ff]/60"
                    : "border-border",
                )}
                style={{ backgroundColor: c.hex }}
              >
                {active && <Check className="h-3.5 w-3.5 text-white" />}
              </button>
            );
          })}
          <label
            title="Custom ink color"
            className="flex h-7 cursor-pointer items-center gap-1.5 rounded-full border border-border bg-secondary px-2.5 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <input
              type="color"
              value={config.inkColor}
              onChange={(e) => onUpdateConfig("inkColor", e.target.value)}
              className="h-4 w-4 cursor-pointer border-0 bg-transparent p-0"
            />
            <span>Custom</span>
          </label>
        </div>
      </div>

      {config.template !== "raw" && (
        <div className="space-y-2">
          <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            Seal Text
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Input
              value={config.topText}
              onChange={(e) => onUpdateConfig("topText", e.target.value)}
              placeholder="Top arc / Header text"
              className="h-8 text-xs"
            />
            <Input
              value={config.bottomText}
              onChange={(e) => onUpdateConfig("bottomText", e.target.value)}
              placeholder="Bottom arc / Subtitle"
              className="h-8 text-xs"
            />
          </div>
          <div className="flex flex-wrap items-center gap-4 pt-0.5">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-foreground/90">
              <Checkbox
                checked={config.showStars}
                onCheckedChange={(v) => onUpdateConfig("showStars", Boolean(v))}
              />
              <span>Divider stars (★)</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-foreground/90">
              <Checkbox
                checked={config.showDate}
                onCheckedChange={(v) => onUpdateConfig("showDate", Boolean(v))}
              />
              <span>Include today&apos;s date</span>
            </label>
          </div>
        </div>
      )}

      <div className="space-y-2.5">
        <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          Ink Realism &amp; Size
        </div>
        {hasSource && (
          <SliderField
            label="Logo scale"
            valueText={`${Math.round(config.logoScale * 100)}%`}
            min={40}
            max={120}
            value={Math.round(config.logoScale * 100)}
            onChange={(v) => onUpdateConfig("logoScale", v / 100)}
          />
        )}
        <div className="grid grid-cols-2 gap-3">
          <SliderField
            label="Ink wear"
            valueText={`${config.distress}%`}
            min={0}
            max={85}
            value={config.distress}
            onChange={(v) => onUpdateConfig("distress", v)}
          />
          <SliderField
            label="Tilt angle"
            valueText={`${placementTilt}°`}
            min={-20}
            max={20}
            value={placementTilt}
            onChange={onPlacementTiltChange}
          />
        </div>
      </div>

      <div className="space-y-2 rounded-xl border border-border bg-secondary/45 p-3">
        <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-foreground">
          <Checkbox
            checked={saveToLibrary}
            onCheckedChange={(v) => onSaveToLibraryChange(Boolean(v))}
          />
          <span>Save stamp to library</span>
        </label>
        {saveToLibrary && (
          <Input
            value={stampName}
            onChange={(e) => onStampNameChange(e.target.value)}
            placeholder="Stamp name (e.g. Registrar Official Seal)"
            className="h-8 text-xs"
          />
        )}
      </div>
    </div>
  );
}
