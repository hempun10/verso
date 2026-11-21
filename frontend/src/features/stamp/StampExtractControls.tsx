import { Checkbox } from "@/components/ui/checkbox";
import type { StampExtractMode } from "@/lib/stampRenderer";
import { cn } from "@/lib/utils";
import { useStampStudio } from "./StampStudioContext";

const EXTRACT_MODES: { id: StampExtractMode; label: string; hint: string }[] = [
  { id: "ink", label: "Logo / Scan", hint: "Clean logos & paper scans" },
  { id: "engraved", label: "Engraved", hint: "Full-color emblems & crests" },
  { id: "cutout", label: "Photo Cutout", hint: "Isolate subject from photo" },
];

export function StampExtractControls() {
  const {
    extractMode,
    setExtractMode,
    sensitivity,
    setSensitivity,
    removeInnerWhite,
    setRemoveInnerWhite,
  } = useStampStudio();

  return (
    <div className="space-y-2.5 rounded-xl border border-border bg-secondary/45 p-3.5">
      <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
        1. Pixel Capture &amp; Background Removal
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {EXTRACT_MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            title={m.hint}
            onClick={() => setExtractMode(m.id)}
            className={cn(
              "cursor-pointer rounded-lg border px-2 py-1.5 text-center text-[11px] font-medium transition-colors",
              extractMode === m.id
                ? "border-[#7170ff]/70 bg-[#7170ff]/18 text-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground">Ink sensitivity</span>
          <span className="font-mono text-foreground tabular-nums">
            {sensitivity}%
          </span>
        </div>
        <input
          type="range"
          min={10}
          max={92}
          value={sensitivity}
          onChange={(e) => setSensitivity(Number(e.target.value))}
          className="h-1.5 w-full cursor-pointer accent-[#7170ff]"
        />
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-xs text-foreground/90">
        <Checkbox
          checked={removeInnerWhite}
          onCheckedChange={(v) => setRemoveInnerWhite(Boolean(v))}
        />
        <span>Make interior white areas transparent</span>
      </label>
    </div>
  );
}
