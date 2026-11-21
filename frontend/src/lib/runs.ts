import type { TextBlock, TextEdit, TextRun, TextRunStyle } from "@/types";

export interface SelectionRange {
  start: number;
  end: number;
}

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
  if (run.font_family_override) style.font_family_override = run.font_family_override;
  if (run.font_size_pt_override != null) style.font_size_pt_override = run.font_size_pt_override;
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
  return normalizeRuns([
    {
      text,
      ...(edit ? extractStyle(edit) : {}),
    },
  ]);
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

  if (normalized.length === 0) {
    if (block.text === "") return null;
    return { block_id: block.id, new_text: "" };
  }

  if (normalized.length === 1) {
    const only = normalized[0];
    const style = extractStyle(only);
    if (newText === block.text && !hasEffectiveStyleOverride(block, style)) {
      return null;
    }
    return {
      block_id: block.id,
      new_text: newText,
      ...style,
      runs: null,
    };
  }

  return {
    block_id: block.id,
    new_text: newText,
    runs: normalized,
  };
}

/**
 * Apply a style patch to `[range.start, range.end)` if a non-empty selection exists,
 * or to all runs in the block when no text is highlighted.
 */
export function applyStyleToRange(
  runs: TextRun[],
  range: SelectionRange | null,
  patch: Partial<TextRunStyle>,
): TextRun[] {
  const totalLen = runsToPlainText(runs).length;
  const hasSelection =
    range !== null && range.start < range.end && range.start < totalLen;
  const start = hasSelection ? Math.max(0, range.start) : 0;
  const end = hasSelection ? Math.min(totalLen, range.end) : totalLen;

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
    const merged: TextRun = {
      ...extractStyle(run),
      ...patch,
      text: run.text.slice(localStart, localEnd),
    };
    next.push(merged);
    if (localEnd < run.text.length) {
      next.push({ ...extractStyle(run), text: run.text.slice(localEnd) });
    }
  }

  return normalizeRuns(next);
}

/**
 * Transform text case for `[range.start, range.end)` (or entire block if no selection).
 */
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

  const totalLen = runsToPlainText(runs).length;
  const hasSelection =
    range !== null && range.start < range.end && range.start < totalLen;
  const start = hasSelection ? Math.max(0, range.start) : 0;
  const end = hasSelection ? Math.min(totalLen, range.end) : totalLen;

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

/**
 * Compute active inspector style values for the selected range (or whole block if collapsed).
 */
export function getActiveStyleForRange(
  block: TextBlock,
  runs: TextRun[],
  range: SelectionRange | null,
) {
  const totalLen = runsToPlainText(runs).length;
  const hasSelection =
    range !== null && range.start < range.end && range.start < totalLen;
  const start = hasSelection ? Math.max(0, range.start) : 0;
  const end = hasSelection ? Math.min(totalLen, range.end) : totalLen;

  const covered: TextRun[] = [];
  let cursor = 0;
  for (const run of runs) {
    const rStart = cursor;
    const rEnd = cursor + run.text.length;
    cursor = rEnd;
    if (rEnd > start && rStart < end) {
      covered.push(run);
    }
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

  const first = covered[0];
  return {
    bold: covered.every((r) => (r.bold_override ?? block.style.bold)),
    italic: covered.every((r) => (r.italic_override ?? block.style.italic)),
    underline: covered.every((r) => Boolean(r.underline)),
    strikethrough: covered.every((r) => Boolean(r.strikethrough)),
    colorHex: first.color_hex_override ?? block.style.color_hex,
    highlightHex: first.highlight_hex ?? null,
    fontFamilyOverride: first.font_family_override ?? null,
    fontSizePt: first.font_size_pt_override ?? block.style.font_size_pt,
  };
}

/**
 * Render `runs` as styled `<span>` nodes into a contentEditable root element.
 */
export function renderRunsIntoDom(
  container: HTMLElement,
  runs: TextRun[],
  block: TextBlock,
  zoom: number,
) {
  container.textContent = "";
  for (const run of runs) {
    const span = document.createElement("span");
    const style = extractStyle(run);
    span.dataset.runStyle = JSON.stringify(style);
    span.textContent = run.text;

    const bold = run.bold_override ?? block.style.bold;
    const italic = run.italic_override ?? block.style.italic;
    const family = run.font_family_override ?? block.style.font_family;
    const sizePt = run.font_size_pt_override ?? block.style.font_size_pt;
    const color = run.color_hex_override ?? block.style.color_hex;
    const decorations = [
      run.underline ? "underline" : "",
      run.strikethrough ? "line-through" : "",
    ]
      .filter(Boolean)
      .join(" ");

    span.style.fontFamily = cssFontStack(
      family,
      block.style.serif,
      block.style.mono,
    );
    span.style.fontSize = `${sizePt * zoom}px`;
    span.style.fontWeight = bold ? "700" : "400";
    span.style.fontStyle = italic ? "italic" : "normal";
    span.style.textDecoration = decorations || "none";
    span.style.color = color;
    if (run.highlight_hex) {
      span.style.backgroundColor = run.highlight_hex;
      span.style.borderRadius = "2px";
    }
    container.appendChild(span);
  }
}

/**
 * Parse the current DOM contents of the contentEditable element back into normalized runs.
 */
export function parseRunsFromDom(
  container: HTMLElement,
  fallbackStyle: TextRunStyle,
): TextRun[] {
  const runs: TextRun[] = [];

  const visit = (node: Node, inherited: TextRunStyle) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent ?? "").replace(/\r?\n/g, "");
      if (text) {
        runs.push({ ...inherited, text });
      }
      return;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.tagName === "BR") return;
      let nextStyle = inherited;
      if (el.dataset.runStyle) {
        try {
          nextStyle = extractStyle(JSON.parse(el.dataset.runStyle) as TextRunStyle);
        } catch {
          nextStyle = inherited;
        }
      }
      for (const child of Array.from(el.childNodes)) {
        visit(child, nextStyle);
      }
    }
  };

  for (const child of Array.from(container.childNodes)) {
    visit(child, fallbackStyle);
  }
  return normalizeRuns(runs);
}

/**
 * Compute flat character offsets `[start, end]` of the current DOM Selection inside `container`.
 */
export function getSelectionOffsets(
  container: HTMLElement,
): SelectionRange | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (
    !container.contains(range.startContainer) ||
    !container.contains(range.endContainer)
  ) {
    return null;
  }

  const offsetOf = (targetNode: Node, targetOffset: number): number => {
    if (targetNode === container) {
      let acc = 0;
      for (let i = 0; i < targetOffset && i < container.childNodes.length; i++) {
        acc += (container.childNodes[i].textContent ?? "").length;
      }
      return acc;
    }
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let acc = 0;
    let node = walker.nextNode();
    while (node) {
      if (node === targetNode) {
        return acc + targetOffset;
      }
      acc += (node.textContent ?? "").length;
      node = walker.nextNode();
    }
    // If targetNode is an element wrapper (e.g. a <span>), sum preceding text nodes + child text.
    if (targetNode.nodeType === Node.ELEMENT_NODE) {
      const preRange = document.createRange();
      preRange.selectNodeContents(container);
      preRange.setEnd(targetNode, targetOffset);
      return preRange.toString().length;
    }
    return acc;
  };

  const a = offsetOf(range.startContainer, range.startOffset);
  const b = offsetOf(range.endContainer, range.endOffset);
  return { start: Math.min(a, b), end: Math.max(a, b) };
}

/**
 * Restore a flat character offset selection `[start, end]` inside `container`.
 */
export function setSelectionOffsets(
  container: HTMLElement,
  start: number,
  end: number,
) {
  const sel = window.getSelection();
  if (!sel) return;

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  let acc = 0;
  let startNode: Node | null = null;
  let startOff = 0;
  let endNode: Node | null = null;
  let endOff = 0;

  while (node) {
    const len = (node.textContent ?? "").length;
    if (!startNode && start <= acc + len) {
      startNode = node;
      startOff = Math.max(0, start - acc);
    }
    if (!endNode && end <= acc + len) {
      endNode = node;
      endOff = Math.max(0, end - acc);
      break;
    }
    acc += len;
    node = walker.nextNode();
  }

  const range = document.createRange();
  if (startNode && endNode) {
    range.setStart(startNode, startOff);
    range.setEnd(endNode, endOff);
  } else {
    range.selectNodeContents(container);
    range.collapse(false);
  }
  sel.removeAllRanges();
  sel.addRange(range);
}
