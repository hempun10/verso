import type { TextBlock, TextEdit, TextRun, TextRunStyle } from "@/types";

export interface SelectionRange {
  start: number;
  end: number;
}

export type ActiveRangeStyle = ReturnType<typeof getActiveStyleForRange>;

export function cssFontStack(family: string, serif: boolean, mono: boolean) {
  if (mono || family === "courier") return '"Courier New", Courier, monospace';
  if (family === "georgia") return 'Georgia, "Times New Roman", serif';
  if (serif || family === "times") return '"Times New Roman", Times, serif';
  return 'Helvetica, Arial, -apple-system, BlinkMacSystemFont, sans-serif';
}

export function isLightColor(colorHex: string): boolean {
  const raw = colorHex.trim().replace(/^#/, "");
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return false;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.7;
}

export function editorBackgroundForRuns(
  block: TextBlock,
  runs: TextRun[],
): string {
  const hasLightUnHighlightedText =
    runs.length === 0
      ? isLightColor(block.style.color_hex)
      : runs.some((r) => {
          if (r.highlight_hex) return false;
          const color = r.color_hex_override ?? block.style.color_hex;
          return isLightColor(color);
        });
  return hasLightUnHighlightedText
    ? "rgba(24, 24, 27, 0.92)"
    : "rgba(255, 255, 255, 0.94)";
}

export function extractStyle(run: TextRunStyle): TextRunStyle {
  const style: TextRunStyle = {};
  if (run.font_family_override)
    style.font_family_override = run.font_family_override;
  if (run.font_size_pt_override != null)
    style.font_size_pt_override = run.font_size_pt_override;
  if (run.color_hex_override) style.color_hex_override = run.color_hex_override;
  if (run.bold_override !== undefined && run.bold_override !== null)
    style.bold_override = run.bold_override;
  if (run.italic_override !== undefined && run.italic_override !== null)
    style.italic_override = run.italic_override;
  if (run.underline) style.underline = true;
  if (run.strikethrough) style.strikethrough = true;
  if (run.highlight_hex) style.highlight_hex = run.highlight_hex;
  return style;
}

function stylesEqual(a: TextRunStyle, b: TextRunStyle): boolean {
  return (
    (a.font_family_override ?? null) === (b.font_family_override ?? null) &&
    (a.font_size_pt_override ?? null) === (b.font_size_pt_override ?? null) &&
    (a.color_hex_override ?? null) === (b.color_hex_override ?? null) &&
    (a.bold_override ?? null) === (b.bold_override ?? null) &&
    (a.italic_override ?? null) === (b.italic_override ?? null) &&
    Boolean(a.underline) === Boolean(b.underline) &&
    Boolean(a.strikethrough) === Boolean(b.strikethrough) &&
    (a.highlight_hex ?? null) === (b.highlight_hex ?? null)
  );
}

export function normalizeRuns(runs: TextRun[]): TextRun[] {
  const out: TextRun[] = [];
  for (const run of runs) {
    if (!run.text) continue;
    const cleaned: TextRun = { text: run.text, ...extractStyle(run) };
    const prev = out[out.length - 1];
    if (prev && stylesEqual(prev, cleaned)) {
      prev.text += cleaned.text;
    } else {
      out.push(cleaned);
    }
  }
  return out;
}

export function runsToPlainText(runs: TextRun[]): string {
  return runs.map((r) => r.text).join("");
}

export function getInitialRuns(
  block: TextBlock,
  edit: TextEdit | null,
): TextRun[] {
  if (edit?.runs && edit.runs.length > 0) {
    return normalizeRuns(edit.runs);
  }
  const text = edit?.new_text ?? block.text;
  if (!text) return [];
  return normalizeRuns([{ text, ...(edit ? extractStyle(edit) : {}) }]);
}

function hasEffectiveStyleOverride(
  block: TextBlock,
  style: TextRunStyle,
): boolean {
  return Boolean(
    style.font_family_override ||
      (style.font_size_pt_override != null &&
        style.font_size_pt_override !== block.style.font_size_pt) ||
      (style.color_hex_override &&
        style.color_hex_override.toLowerCase() !==
          block.style.color_hex.toLowerCase()) ||
      (style.bold_override !== undefined &&
        style.bold_override !== null &&
        style.bold_override !== block.style.bold) ||
      (style.italic_override !== undefined &&
        style.italic_override !== null &&
        style.italic_override !== block.style.italic) ||
      style.underline ||
      style.strikethrough ||
      style.highlight_hex,
  );
}

export function runsToEdit(
  block: TextBlock,
  rawRuns: TextRun[],
): TextEdit | null {
  const normalized = normalizeRuns(rawRuns);
  const newText = runsToPlainText(normalized);
  const sourceBlock = block.kind === "scanned" ? block : undefined;

  if (normalized.length === 0) {
    return block.text === ""
      ? null
      : {
          block_id: block.id,
          new_text: "",
          ...(sourceBlock ? { source_block: sourceBlock } : {}),
        };
  }

  if (normalized.length === 1) {
    const only = normalized[0]!;
    const style = extractStyle(only);
    if (newText === block.text && !hasEffectiveStyleOverride(block, style)) {
      return null;
    }
    return {
      block_id: block.id,
      new_text: newText,
      ...style,
      runs: null,
      ...(sourceBlock ? { source_block: sourceBlock } : {}),
    };
  }

  return {
    block_id: block.id,
    new_text: newText,
    runs: normalized,
    ...(sourceBlock ? { source_block: sourceBlock } : {}),
  };
}

function resolveRangeBounds(
  runs: TextRun[],
  range: SelectionRange | null,
): [number, number] {
  const totalLen = runsToPlainText(runs).length;
  const hasSelection =
    range !== null && range.start < range.end && range.start < totalLen;
  return [
    hasSelection ? Math.max(0, range.start) : 0,
    hasSelection ? Math.min(totalLen, range.end) : totalLen,
  ];
}

export function applyStyleToRange(
  runs: TextRun[],
  range: SelectionRange | null,
  patch: Partial<TextRunStyle>,
): TextRun[] {
  const [start, end] = resolveRangeBounds(runs, range);
  const next: TextRun[] = [];
  let cursor = 0;

  for (const run of runs) {
    const rStart = cursor;
    const rEnd = cursor + run.text.length;
    cursor = rEnd;
    if (rEnd <= start || rStart >= end) {
      next.push({ ...run });
      continue;
    }
    const localStart = Math.max(0, start - rStart);
    const localEnd = Math.min(run.text.length, end - rStart);
    if (localStart > 0) {
      next.push({ ...extractStyle(run), text: run.text.slice(0, localStart) });
    }
    next.push({
      ...extractStyle(run),
      ...patch,
      text: run.text.slice(localStart, localEnd),
    });
    if (localEnd < run.text.length) {
      next.push({ ...extractStyle(run), text: run.text.slice(localEnd) });
    }
  }
  return normalizeRuns(next);
}

export function transformCaseInRange(
  runs: TextRun[],
  range: SelectionRange | null,
  mode: "upper" | "lower" | "title",
): TextRun[] {
  const transform = (s: string) => {
    if (mode === "upper") return s.toUpperCase();
    if (mode === "lower") return s.toLowerCase();
    return s.replace(
      /\b\w+/g,
      (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
    );
  };
  const [start, end] = resolveRangeBounds(runs, range);
  const next: TextRun[] = [];
  let cursor = 0;

  for (const run of runs) {
    const rStart = cursor;
    const rEnd = cursor + run.text.length;
    cursor = rEnd;
    if (rEnd <= start || rStart >= end) {
      next.push({ ...run });
      continue;
    }
    const localStart = Math.max(0, start - rStart);
    const localEnd = Math.min(run.text.length, end - rStart);
    const updatedText =
      run.text.slice(0, localStart) +
      transform(run.text.slice(localStart, localEnd)) +
      run.text.slice(localEnd);
    next.push({ ...extractStyle(run), text: updatedText });
  }
  return normalizeRuns(next);
}

export function getActiveStyleForRange(
  block: TextBlock,
  runs: TextRun[],
  range: SelectionRange | null,
) {
  const [start, end] = resolveRangeBounds(runs, range);
  const covered: TextRun[] = [];
  let cursor = 0;
  for (const run of runs) {
    const rStart = cursor;
    const rEnd = cursor + run.text.length;
    cursor = rEnd;
    if (rEnd > start && rStart < end) covered.push(run);
  }
  if (covered.length === 0) {
    return {
      bold: block.style.bold,
      italic: block.style.italic,
      underline: false,
      strikethrough: false,
      colorHex: block.style.color_hex,
      highlightHex: null as string | null,
      fontFamilyOverride: null as string | null,
      fontSizePt: block.style.font_size_pt,
    };
  }
  const first = covered[0]!;
  return {
    bold: covered.every((r) => r.bold_override ?? block.style.bold),
    italic: covered.every((r) => r.italic_override ?? block.style.italic),
    underline: covered.every((r) => Boolean(r.underline)),
    strikethrough: covered.every((r) => Boolean(r.strikethrough)),
    colorHex: first.color_hex_override ?? block.style.color_hex,
    highlightHex: first.highlight_hex ?? null,
    fontFamilyOverride: first.font_family_override ?? null,
    fontSizePt: first.font_size_pt_override ?? block.style.font_size_pt,
  };
}
