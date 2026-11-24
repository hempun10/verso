export interface PixelBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  score: number;
}

const DET_THRESH = 0.3;
const BOX_SCORE_THRESH = 0.5;
const UNCLIP_RATIO = 1.6;
const MIN_BOX_SIDE_MAP = 3;

/**
 * Extract axis-aligned text line boxes from a DBNet probability map using iterative
 * connected-components flood fill and exact rectangular unclip expansion.
 */
export function extractDetBoxes(
  probMap: Float32Array,
  mapW: number,
  mapH: number,
  origW: number,
  origH: number,
): PixelBox[] {
  const total = mapW * mapH;
  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  const boxes: PixelBox[] = [];

  const scaleX = origW / Math.max(mapW, 1);
  const scaleY = origH / Math.max(mapH, 1);

  for (let start = 0; start < total; start++) {
    if (visited[start] || probMap[start]! <= DET_THRESH) continue;

    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    visited[start] = 1;

    let minX = start % mapW;
    let maxX = minX;
    let minY = (start / mapW) | 0;
    let maxY = minY;
    let probSum = 0;
    let count = 0;

    while (head < tail) {
      const idx = queue[head++]!;
      const x = idx % mapW;
      const y = (idx / mapW) | 0;
      probSum += probMap[idx]!;
      count++;

      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;

      if (x > 0) {
        const n = idx - 1;
        if (!visited[n] && probMap[n]! > DET_THRESH) {
          visited[n] = 1;
          queue[tail++] = n;
        }
      }
      if (x + 1 < mapW) {
        const n = idx + 1;
        if (!visited[n] && probMap[n]! > DET_THRESH) {
          visited[n] = 1;
          queue[tail++] = n;
        }
      }
      if (y > 0) {
        const n = idx - mapW;
        if (!visited[n] && probMap[n]! > DET_THRESH) {
          visited[n] = 1;
          queue[tail++] = n;
        }
      }
      if (y + 1 < mapH) {
        const n = idx + mapW;
        if (!visited[n] && probMap[n]! > DET_THRESH) {
          visited[n] = 1;
          queue[tail++] = n;
        }
      }
    }

    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    if (bw < MIN_BOX_SIDE_MAP || bh < MIN_BOX_SIDE_MAP) continue;

    const meanScore = probSum / Math.max(count, 1);
    if (meanScore < BOX_SCORE_THRESH) continue;

    // Rectangular DBNet unclip: d = area * unclip_ratio / perimeter.
    const area = bw * bh;
    const perimeter = 2 * (bw + bh);
    const pad = (area * UNCLIP_RATIO) / Math.max(perimeter, 1);
    // Slightly tighter vertical unclip avoids merging adjacent tight lines.
    const padX = pad * 0.95;
    const padY = pad * 0.8;

    const x0 = Math.max(0, Math.floor((minX - padX) * scaleX));
    const y0 = Math.max(0, Math.floor((minY - padY) * scaleY));
    const x1 = Math.min(origW, Math.ceil((maxX + 1 + padX) * scaleX));
    const y1 = Math.min(origH, Math.ceil((maxY + 1 + padY) * scaleY));

    if (x1 - x0 < 6 || y1 - y0 < 6) continue;
    boxes.push({ x0, y0, x1, y1, score: meanScore });
  }

  return sortReadingOrder(boxes);
}

function sortReadingOrder(boxes: PixelBox[]): PixelBox[] {
  const sorted = [...boxes].sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);
  for (let i = 0; i < sorted.length - 1; i++) {
    for (let j = i; j >= 0; j--) {
      const a = sorted[j]!;
      const b = sorted[j + 1]!;
      const lineTol = Math.min(a.y1 - a.y0, b.y1 - b.y0) * 0.55;
      if (Math.abs(b.y0 - a.y0) < lineTol && b.x0 < a.x0) {
        sorted[j] = b;
        sorted[j + 1] = a;
      } else {
        break;
      }
    }
  }
  return sorted;
}

/**
 * Greedy CTC decode for PP-OCRv4 recognition output shaped [1, timeSteps, numClasses].
 */
export function decodeCtcText(
  logits: Float32Array,
  timeSteps: number,
  numClasses: number,
  dictionary: string[],
): { text: string; confidence: number } {
  let prevIdx = -1;
  const chars: string[] = [];
  let confSum = 0;

  for (let t = 0; t < timeSteps; t++) {
    const base = t * numClasses;
    let bestIdx = 0;
    let bestProb = logits[base]!;
    for (let c = 1; c < numClasses; c++) {
      const val = logits[base + c]!;
      if (val > bestProb) {
        bestProb = val;
        bestIdx = c;
      }
    }
    if (bestIdx !== 0 && bestIdx !== prevIdx) {
      const ch = dictionary[bestIdx];
      if (ch !== undefined && ch !== "") {
        chars.push(ch);
        confSum += bestProb;
      }
    }
    prevIdx = bestIdx;
  }

  const text = chars.join("").trim();
  const confidence = chars.length > 0 ? confSum / chars.length : 0;
  return { text, confidence };
}
