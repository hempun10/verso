import type { TextBlock, TextRun, TextRunStyle } from "@/types";
import {
  cssFontStack,
  extractStyle,
  normalizeRuns,
  type SelectionRange,
} from "./model";

/** Render `runs` as styled `<span>` nodes into a contentEditable root element. */
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

/** Parse the current DOM contents of the contentEditable element back into normalized runs. */
export function parseRunsFromDom(
  container: HTMLElement,
  fallbackStyle: TextRunStyle,
): TextRun[] {
  const runs: TextRun[] = [];

  const visit = (node: Node, inherited: TextRunStyle) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent ?? "").replace(/\r?\n/g, "");
      if (text) runs.push({ ...inherited, text });
      return;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.tagName === "BR") return;
      let nextStyle = inherited;
      if (el.dataset.runStyle) {
        try {
          nextStyle = extractStyle(
            JSON.parse(el.dataset.runStyle) as TextRunStyle,
          );
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

/** Compute flat character offsets `[start, end]` of the current DOM Selection inside `container`. */
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
        acc += (container.childNodes[i]!.textContent ?? "").length;
      }
      return acc;
    }
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let acc = 0;
    let node = walker.nextNode();
    while (node) {
      if (node === targetNode) return acc + targetOffset;
      acc += (node.textContent ?? "").length;
      node = walker.nextNode();
    }
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

/** Restore a flat character offset selection `[start, end]` inside `container`. */
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
