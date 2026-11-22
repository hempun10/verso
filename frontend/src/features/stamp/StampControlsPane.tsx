import { Check } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  STAMP_INK_PRESETS,
  type StampBorderStyle,
  type StampTemplate,
} from "@/lib/stampRenderer";
import { cn } from "@/lib/utils";
import { StampExtractControls } from "./StampExtractControls";
import { useStampStudio } from "./StampStudioContext";

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
      <div className="flex items-center justify-between text-label">
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
        className="h-1.5 w-full cursor-pointer accent-brand"
      />
    </div>
  );
}

export function StampControlsPane() {
  const {
    hasSource,
    config,
    updateConfig,
    placementTilt,
    setPlacementTilt,
    saveToLibrary,
    setSaveToLibrary,
    stampName,
    setStampName,
  } = useStampStudio();

  return (
    <div className="flex flex-col gap-4 overflow-y-auto p-5">
      {hasSource && <StampExtractControls />}

      <div className="space-y-2.5">
        <div className="text-label font-semibold tracking-wider text-muted-foreground uppercase">
          Seal Style &amp; Ink
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => updateConfig("template", t.id)}
              className={cn(
                "cursor-pointer rounded-lg border px-2 py-1.5 text-center text-label font-medium transition-colors",
                config.template === t.id
                  ? "border-brand/70 bg-brand/18 text-foreground"
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
                onClick={() => updateConfig("borderStyle", b.id)}
                className={cn(
                  "cursor-pointer rounded-md border px-2 py-1 text-label font-medium transition-colors",
                  config.borderStyle === b.id
                    ? "border-input bg-surface-active text-foreground"
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
                onClick={() => updateConfig("inkColor", c.hex)}
                className={cn(
                  "flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-2 transition-transform hover:scale-105",
                  active
                    ? "border-white ring-2 ring-brand/60"
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
            className="flex h-7 cursor-pointer items-center gap-1.5 rounded-full border border-border bg-secondary px-2.5 text-label text-muted-foreground hover:text-foreground"
          >
            <input
              type="color"
              value={config.inkColor}
              onChange={(e) => updateConfig("inkColor", e.target.value)}
              className="h-4 w-4 cursor-pointer border-0 bg-transparent p-0"
            />
            <span>Custom</span>
          </label>
        </div>
      </div>

      {config.template !== "raw" && (
        <div className="space-y-2">
          <div className="text-label font-semibold tracking-wider text-muted-foreground uppercase">
            Seal Text
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Input
              value={config.topText}
              onChange={(e) => updateConfig("topText", e.target.value)}
              placeholder="Top arc / Header text"
              className="h-8 text-xs"
            />
            <Input
              value={config.bottomText}
              onChange={(e) => updateConfig("bottomText", e.target.value)}
              placeholder="Bottom arc / Subtitle"
              className="h-8 text-xs"
            />
          </div>
          <div className="flex flex-wrap items-center gap-4 pt-0.5">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-foreground/90">
              <Checkbox
                checked={config.showStars}
                onCheckedChange={(v) => updateConfig("showStars", Boolean(v))}
              />
              <span>Divider stars (★)</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-foreground/90">
              <Checkbox
                checked={config.showDate}
                onCheckedChange={(v) => updateConfig("showDate", Boolean(v))}
              />
              <span>Include today&apos;s date</span>
            </label>
          </div>
        </div>
      )}

      <div className="space-y-2.5">
        <div className="text-label font-semibold tracking-wider text-muted-foreground uppercase">
          Ink Realism &amp; Size
        </div>
        {hasSource && (
          <SliderField
            label="Logo scale"
            valueText={`${Math.round(config.logoScale * 100)}%`}
            min={40}
            max={120}
            value={Math.round(config.logoScale * 100)}
            onChange={(v) => updateConfig("logoScale", v / 100)}
          />
        )}
        <div className="grid grid-cols-2 gap-3">
          <SliderField
            label="Ink wear"
            valueText={`${config.distress}%`}
            min={0}
            max={85}
            value={config.distress}
            onChange={(v) => updateConfig("distress", v)}
          />
          <SliderField
            label="Tilt angle"
            valueText={`${placementTilt}°`}
            min={-20}
            max={20}
            value={placementTilt}
            onChange={setPlacementTilt}
          />
        </div>
      </div>

      <div className="space-y-2 rounded-xl border border-border bg-secondary/45 p-3">
        <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-foreground">
          <Checkbox
            checked={saveToLibrary}
            onCheckedChange={(v) => setSaveToLibrary(Boolean(v))}
          />
          <span>Save stamp to library</span>
        </label>
        {saveToLibrary && (
          <Input
            value={stampName}
            onChange={(e) => setStampName(e.target.value)}
            placeholder="Stamp name (e.g. Registrar Official Seal)"
            className="h-8 text-xs"
          />
        )}
      </div>
    </div>
  );
}
