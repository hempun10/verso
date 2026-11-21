import { cropCanvasToTrimmedPng } from "@/lib/canvas";

export type StampExtractMode = "ink" | "engraved" | "cutout";
export type StampTemplate = "circle" | "oval" | "rect" | "raw";
export type StampBorderStyle = "classic" | "dotted" | "notary";

export interface StampConfig {
  template: StampTemplate;
  borderStyle: StampBorderStyle;
  inkColor: string;
  topText: string;
  bottomText: string;
  showStars: boolean;
  showDate: boolean;
  logoScale: number; // 0.35..1.25
  distress: number; // 0..100
  seed: number;
}

export const STAMP_INK_PRESETS = [
  { hex: "#1b3f8b", label: "Official Blue" },
  { hex: "#b91c1c", label: "Crimson Red" },
  { hex: "#4c1d95", label: "Stamp Violet" },
  { hex: "#18181b", label: "Archival Black" },
  { hex: "#166534", label: "Verified Green" },
] as const;

export function formatStampDate(date = new Date()): string {
  const day = String(date.getDate()).padStart(2, "0");
  const months = [
    "JAN",
    "FEB",
    "MAR",
    "APR",
    "MAY",
    "JUN",
    "JUL",
    "AUG",
    "SEP",
    "OCT",
    "NOV",
    "DEC",
  ];
  return `${day} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

export function getStampCanvasSize(template: StampTemplate): {
  width: number;
  height: number;
} {
  switch (template) {
    case "oval":
      return { width: 1024, height: 680 };
    case "rect":
      return { width: 1024, height: 520 };
    case "circle":
    case "raw":
    default:
      return { width: 1024, height: 1024 };
  }
}

/** Draw a pure-white alpha mask image tinted cleanly into the given ink color. */
function drawTintedMask(
  ctx: CanvasRenderingContext2D,
  maskImg: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  inkColor: string,
) {
  const off = document.createElement("canvas");
  off.width = Math.max(1, Math.round(dw));
  off.height = Math.max(1, Math.round(dh));
  const octx = off.getContext("2d");
  if (!octx) return;

  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = "high";
  octx.drawImage(maskImg, 0, 0, off.width, off.height);
  octx.globalCompositeOperation = "source-in";
  octx.fillStyle = inkColor;
  octx.fillRect(0, 0, off.width, off.height);

  ctx.drawImage(off, dx, dy, dw, dh);
}

/** Draw a 5-point official seal star centered at (cx, cy). */
function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

/** Draw curved text along a circular arc. */
function drawCircularArcText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  radius: number,
  isBottom: boolean,
  maxArcRad: number,
  baseFontPx: number,
) {
  const clean = text.trim().toUpperCase();
  if (!clean) return;

  // Auto-shrink font size slightly for long department/agency names so text never overlaps stars.
  let fontPx = baseFontPx;
  const setFont = (px: number) => {
    ctx.font = `700 ${px}px Georgia, "Times New Roman", "Liberation Serif", serif`;
  };
  setFont(fontPx);

  const chars = Array.from(clean);
  const measureTotalArc = (px: number) => {
    setFont(px);
    const tracking = px * 0.14;
    let totalW = 0;
    for (let i = 0; i < chars.length; i++) {
      totalW += ctx.measureText(chars[i]!).width;
      if (i < chars.length - 1) totalW += tracking;
    }
    return totalW / radius;
  };

  while (fontPx > 24 && measureTotalArc(fontPx) > maxArcRad) {
    fontPx -= 2;
  }

  setFont(fontPx);
  const tracking = fontPx * 0.14;
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const totalW =
    widths.reduce((acc, w) => acc + w, 0) +
    Math.max(0, chars.length - 1) * tracking;
  const totalAngle = totalW / radius;

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (!isBottom) {
    let cursor = -Math.PI / 2 - totalAngle / 2;
    for (let i = 0; i < chars.length; i++) {
      const charAngle = widths[i]! / radius;
      const mid = cursor + charAngle / 2;
      ctx.save();
      ctx.translate(cx + Math.cos(mid) * radius, cy + Math.sin(mid) * radius);
      ctx.rotate(mid + Math.PI / 2);
      ctx.fillText(chars[i]!, 0, 0);
      ctx.restore();
      cursor += charAngle + tracking / radius;
    }
  } else {
    // Bottom arc reads left-to-right upright.
    let cursor = Math.PI / 2 + totalAngle / 2;
    for (let i = 0; i < chars.length; i++) {
      const charAngle = widths[i]! / radius;
      const mid = cursor - charAngle / 2;
      ctx.save();
      ctx.translate(cx + Math.cos(mid) * radius, cy + Math.sin(mid) * radius);
      ctx.rotate(mid - Math.PI / 2);
      ctx.fillText(chars[i]!, 0, 0);
      ctx.restore();
      cursor -= charAngle + tracking / radius;
    }
  }
}

/** Draw curved text along an elliptical arc (for oval notary seals). */
function drawEllipticalArcText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  isBottom: boolean,
  baseFontPx: number,
) {
  const clean = text.trim().toUpperCase();
  if (!clean) return;

  let fontPx = baseFontPx;
  const setFont = (px: number) => {
    ctx.font = `700 ${px}px Georgia, "Times New Roman", serif`;
  };
  setFont(fontPx);

  const chars = Array.from(clean);
  const avgR = Math.sqrt((rx * rx + ry * ry) / 2);
  const maxSpan = 2.05;

  const measureSpan = (px: number) => {
    setFont(px);
    const tracking = px * 0.14;
    const totalW =
      chars.reduce((s, c) => s + ctx.measureText(c).width, 0) +
      Math.max(0, chars.length - 1) * tracking;
    return totalW / avgR;
  };
  while (fontPx > 22 && measureSpan(fontPx) > maxSpan) {
    fontPx -= 2;
  }

  setFont(fontPx);
  const tracking = fontPx * 0.14;
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const totalW =
    widths.reduce((a, b) => a + b, 0) + Math.max(0, chars.length - 1) * tracking;

  // Compute parametric step using local arc-length ds/dt = sqrt((rx*sin t)^2 + (ry*cos t)^2).
  const stepAngle = (t: number, arcLen: number) => {
    const ds = Math.hypot(-rx * Math.sin(t), ry * Math.cos(t));
    return arcLen / Math.max(1, ds);
  };

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (!isBottom) {
    // Walk half totalW backwards from top (-PI/2) to find starting t.
    let t = -Math.PI / 2;
    const steps = 20;
    for (let s = 0; s < steps; s++) {
      t -= stepAngle(t, totalW / 2 / steps);
    }
    for (let i = 0; i < chars.length; i++) {
      const half = stepAngle(t, widths[i]! / 2);
      const mid = t + half;
      const x = cx + Math.cos(mid) * rx;
      const y = cy + Math.sin(mid) * ry;
      const tangent = Math.atan2(ry * Math.cos(mid), -rx * Math.sin(mid));
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(tangent);
      ctx.fillText(chars[i]!, 0, 0);
      ctx.restore();
      t = mid + stepAngle(mid, widths[i]! / 2 + tracking);
    }
  } else {
    let t = Math.PI / 2;
    const steps = 20;
    for (let s = 0; s < steps; s++) {
      t += stepAngle(t, totalW / 2 / steps);
    }
    for (let i = 0; i < chars.length; i++) {
      const half = stepAngle(t, widths[i]! / 2);
      const mid = t - half;
      const x = cx + Math.cos(mid) * rx;
      const y = cy + Math.sin(mid) * ry;
      const tangent = Math.atan2(ry * Math.cos(mid), -rx * Math.sin(mid)) + Math.PI;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(tangent);
      ctx.fillText(chars[i]!, 0, 0);
      ctx.restore();
      t = mid - stepAngle(mid, widths[i]! / 2 + tracking);
    }
  }
}

/** Draw scalloped / serrated notary seal ring. */
function drawNotaryRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  teeth: number,
  depth: number,
) {
  ctx.beginPath();
  const totalPts = teeth * 2;
  for (let i = 0; i <= totalPts; i++) {
    const a = (i / totalPts) * Math.PI * 2;
    const rScale = i % 2 === 0 ? 1.0 : 1.0 - depth;
    const x = cx + Math.cos(a) * rx * rScale;
    const y = cy + Math.sin(a) * ry * rScale;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();
}

/** Fast deterministic hash for procedural rubber-stamp ink texture. */
function hash2d(ix: number, iy: number, seed: number): number {
  let n =
    Math.imul(ix, 374761393) +
    Math.imul(iy, 668265263) +
    Math.imul(seed, 1442695041);
  n = (n ^ (n >>> 13)) | 0;
  n = Math.imul(n, 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function smoothNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2d(ix, iy, seed);
  const b = hash2d(ix + 1, iy, seed);
  const c = hash2d(ix, iy + 1, seed);
  const d = hash2d(ix + 1, iy + 1, seed);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

/** Apply organic rubber-ink pores, micro-speckle, and uneven hand-press pressure. */
function applyRubberInkDistress(
  ctx: CanvasRenderingContext2D,
  distress: number,
  seed: number,
) {
  if (distress <= 0) return;
  const { width, height } = ctx.canvas;
  const img = ctx.getImageData(0, 0, width, height);
  const data = img.data;
  const strength = Math.min(1, Math.max(0, distress / 100));

  // Random hand-press tilt direction for subtle pressure falloff.
  const pressAngle = hash2d(17, 31, seed) * Math.PI * 2;
  const pdx = Math.cos(pressAngle);
  const pdy = Math.sin(pressAngle);

  const fineScale = 0.24;
  const medScale = 0.055;
  const coarseScale = 0.016;

  for (let y = 0; y < height; y++) {
    const ny = (y / height - 0.5) * 2;
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4 + 3;
      const a = data[idx]!;
      if (a === 0) continue;

      const nx = (x / width - 0.5) * 2;
      // Directional uneven pad pressure (gentle 0.80..1.0 falloff).
      const press = 1.0 - strength * 0.18 * Math.max(0, nx * pdx + ny * pdy + 0.35);

      const nFine = smoothNoise(x * fineScale, y * fineScale, seed + 1);
      const nMed = smoothNoise(x * medScale, y * medScale, seed + 7);
      const nCoarse = smoothNoise(x * coarseScale, y * coarseScale, seed + 23);
      const grain = nFine * 0.52 + nMed * 0.33 + nCoarse * 0.15;

      // Carve dry-ink pores where grain drops below dynamic cutoff.
      const cutoff = 0.14 + strength * 0.36;
      let inkFactor = 1.0;
      if (grain < cutoff) {
        const drop = (cutoff - grain) / Math.max(0.08, cutoff);
        inkFactor = Math.max(0.06, 1.0 - drop * (0.65 + strength * 0.45));
      } else {
        // Subtle mottled texture even in inked regions.
        inkFactor = 0.92 + grain * 0.08;
      }

      data[idx] = Math.max(0, Math.min(255, Math.round(a * press * inkFactor)));
    }
  }

  ctx.putImageData(img, 0, 0);
}

/** Render the full government-style stamp onto the provided canvas. */
export function renderStampToCanvas(
  canvas: HTMLCanvasElement,
  maskImg: HTMLImageElement | null,
  config: StampConfig,
) {
  const size = getStampCanvasSize(config.template);
  if (canvas.width !== size.width || canvas.height !== size.height) {
    canvas.width = size.width;
    canvas.height = size.height;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = config.inkColor;
  ctx.strokeStyle = config.inkColor;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const dateStr = formatStampDate();

  if (config.template === "raw") {
    if (maskImg) {
      const maxDim = Math.min(canvas.width, canvas.height) * 0.78 * config.logoScale;
      const aspect = maskImg.naturalWidth / Math.max(1, maskImg.naturalHeight);
      const dw = aspect >= 1 ? maxDim : maxDim * aspect;
      const dh = aspect >= 1 ? maxDim / aspect : maxDim;
      drawTintedMask(ctx, maskImg, cx - dw / 2, cy - dh / 2, dw, dh, config.inkColor);
    }
  } else if (config.template === "circle") {
    const outerR = 456;
    const innerRingR = 304;
    const textR = (outerR - 18 + innerRingR) / 2;

    if (config.borderStyle === "notary") {
      ctx.lineWidth = 10;
      drawNotaryRing(ctx, cx, cy, outerR + 10, outerR + 10, 64, 0.042);
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(cx, cy, outerR - 16, 0, Math.PI * 2);
      ctx.stroke();
    } else if (config.borderStyle === "dotted") {
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.save();
      ctx.lineWidth = 7;
      ctx.setLineDash([4, 15]);
      ctx.beginPath();
      ctx.arc(cx, cy, outerR - 20, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else {
      // Classic official double ring
      ctx.lineWidth = 16;
      ctx.beginPath();
      ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(cx, cy, outerR - 20, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Inner emblem ring
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(cx, cy, innerRingR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, innerRingR - 12, 0, Math.PI * 2);
    ctx.stroke();

    // Curved Top & Bottom text
    drawCircularArcText(ctx, config.topText, cx, cy, textR, false, 2.55, 58);
    drawCircularArcText(ctx, config.bottomText, cx, cy, textR, true, 2.35, 52);

    // Side stars
    if (config.showStars) {
      drawStar(ctx, cx - textR, cy, 18, 7.5);
      drawStar(ctx, cx + textR, cy, 18, 7.5);
    }

    // Center emblem/logo
    if (maskImg) {
      const avail = (innerRingR - 30) * 1.62 * config.logoScale;
      const maxW = avail;
      const maxH = config.showDate ? avail * 0.72 : avail;
      const aspect = maskImg.naturalWidth / Math.max(1, maskImg.naturalHeight);
      let dw = maxW;
      let dh = dw / aspect;
      if (dh > maxH) {
        dh = maxH;
        dw = dh * aspect;
      }
      const offsetY = config.showDate ? -28 : 0;
      drawTintedMask(
        ctx,
        maskImg,
        cx - dw / 2,
        cy - dh / 2 + offsetY,
        dw,
        dh,
        config.inkColor,
      );
    }

    // Optional date line inside inner circle
    if (config.showDate) {
      const dateY = maskImg ? cy + innerRingR * 0.54 : cy;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx - 135, dateY - 24);
      ctx.lineTo(cx + 135, dateY - 24);
      ctx.moveTo(cx - 135, dateY + 24);
      ctx.lineTo(cx + 135, dateY + 24);
      ctx.stroke();
      ctx.font = '700 32px "Courier New", monospace';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(dateStr, cx, dateY + 1);
    }
  } else if (config.template === "oval") {
    const outerRx = 468;
    const outerRy = 294;
    const innerRx = 330;
    const innerRy = 176;
    const textRx = (outerRx - 16 + innerRx) / 2;
    const textRy = (outerRy - 14 + innerRy) / 2;

    if (config.borderStyle === "notary") {
      ctx.lineWidth = 9;
      drawNotaryRing(ctx, cx, cy, outerRx + 6, outerRy + 6, 72, 0.036);
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.ellipse(cx, cy, outerRx - 18, outerRy - 16, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (config.borderStyle === "dotted") {
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.ellipse(cx, cy, outerRx, outerRy, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.save();
      ctx.lineWidth = 6;
      ctx.setLineDash([4, 14]);
      ctx.beginPath();
      ctx.ellipse(cx, cy, outerRx - 20, outerRy - 18, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.lineWidth = 15;
      ctx.beginPath();
      ctx.ellipse(cx, cy, outerRx, outerRy, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.ellipse(cx, cy, outerRx - 19, outerRy - 17, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.ellipse(cx, cy, innerRx, innerRy, 0, 0, Math.PI * 2);
    ctx.stroke();

    drawEllipticalArcText(ctx, config.topText, cx, cy, textRx, textRy, false, 48);
    drawEllipticalArcText(ctx, config.bottomText, cx, cy, textRx, textRy, true, 44);

    if (config.showStars) {
      drawStar(ctx, cx - textRx, cy, 16, 6.5);
      drawStar(ctx, cx + textRx, cy, 16, 6.5);
    }

    if (maskImg) {
      const maxW = innerRx * 1.35 * config.logoScale;
      const maxH = (config.showDate ? innerRy * 0.92 : innerRy * 1.45) * config.logoScale;
      const aspect = maskImg.naturalWidth / Math.max(1, maskImg.naturalHeight);
      let dw = maxW;
      let dh = dw / aspect;
      if (dh > maxH) {
        dh = maxH;
        dw = dh * aspect;
      }
      const offsetY = config.showDate ? -26 : 0;
      drawTintedMask(
        ctx,
        maskImg,
        cx - dw / 2,
        cy - dh / 2 + offsetY,
        dw,
        dh,
        config.inkColor,
      );
    }

    if (config.showDate) {
      const dateY = maskImg ? cy + innerRy * 0.56 : cy;
      ctx.font = '700 30px "Courier New", monospace';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(dateStr, cx, dateY);
    }
  } else if (config.template === "rect") {
    const pad = 42;
    const bw = canvas.width - pad * 2;
    const bh = canvas.height - pad * 2;
    const radius = 28;

    const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      ctx.stroke();
    };

    ctx.lineWidth = 15;
    roundRect(pad, pad, bw, bh, radius);

    ctx.save();
    if (config.borderStyle === "dotted") {
      ctx.lineWidth = 6;
      ctx.setLineDash([4, 14]);
    } else if (config.borderStyle === "notary") {
      ctx.lineWidth = 6;
      ctx.setLineDash([18, 10]);
    } else {
      ctx.lineWidth = 5;
    }
    roundRect(pad + 20, pad + 20, bw - 40, bh - 40, Math.max(8, radius - 12));
    ctx.restore();

    const innerLeft = pad + 48;
    const innerRight = canvas.width - pad - 48;
    let textCenterX = cx;
    let textMaxW = innerRight - innerLeft;

    if (maskImg) {
      const boxH = bh - 108;
      const boxW = Math.min(280, boxH);
      const scaledW = boxW * config.logoScale;
      const scaledH = boxH * config.logoScale;
      const aspect = maskImg.naturalWidth / Math.max(1, maskImg.naturalHeight);
      let dw = scaledW;
      let dh = dw / aspect;
      if (dh > scaledH) {
        dh = scaledH;
        dw = dh * aspect;
      }
      const logoCenterX = innerLeft + boxW / 2;
      drawTintedMask(
        ctx,
        maskImg,
        logoCenterX - dw / 2,
        cy - dh / 2,
        dw,
        dh,
        config.inkColor,
      );

      // Vertical divider between logo and official text
      const divX = innerLeft + boxW + 28;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(divX, pad + 56);
      ctx.lineTo(divX, canvas.height - pad - 56);
      ctx.stroke();

      textCenterX = (divX + 24 + innerRight) / 2;
      textMaxW = innerRight - (divX + 36);
    }

    const title = config.topText.trim().toUpperCase();
    const subtitle = config.bottomText.trim().toUpperCase();
    const rows: { text: string; font: string; y: number }[] = [];

    if (title && subtitle && config.showDate) {
      rows.push({ text: title, font: '800 58px Georgia, "Times New Roman", serif', y: cy - 84 });
      rows.push({ text: subtitle, font: '700 32px Georgia, "Times New Roman", serif', y: cy + 4 });
      rows.push({ text: dateStr, font: '700 34px "Courier New", monospace', y: cy + 84 });
    } else if (title && (subtitle || config.showDate)) {
      rows.push({ text: title, font: '800 62px Georgia, "Times New Roman", serif', y: cy - 48 });
      rows.push({
        text: subtitle || dateStr,
        font: subtitle
          ? '700 34px Georgia, "Times New Roman", serif'
          : '700 36px "Courier New", monospace',
        y: cy + 46,
      });
    } else if (title || subtitle || config.showDate) {
      rows.push({
        text: title || subtitle || dateStr,
        font: '800 66px Georgia, "Times New Roman", serif',
        y: cy,
      });
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const row of rows) {
      ctx.font = row.font;
      ctx.fillText(row.text, textCenterX, row.y, Math.max(120, textMaxW));
    }

    if (config.showStars && rows.length >= 2) {
      const ruleY = (rows[0]!.y + rows[1]!.y) / 2 + 8;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(textCenterX - Math.min(200, textMaxW * 0.42), ruleY);
      ctx.lineTo(textCenterX - 24, ruleY);
      ctx.moveTo(textCenterX + 24, ruleY);
      ctx.lineTo(textCenterX + Math.min(200, textMaxW * 0.42), ruleY);
      ctx.stroke();
      drawStar(ctx, textCenterX, ruleY, 12, 5);
    }
  }

  applyRubberInkDistress(ctx, config.distress, config.seed);
}

/** Render high-res stamp, tightly crop transparent margins, and return PNG data URL. */
export function exportStampPng(
  maskImg: HTMLImageElement | null,
  config: StampConfig,
): { dataUrl: string; width: number; height: number } | null {
  const canvas = document.createElement("canvas");
  renderStampToCanvas(canvas, maskImg, config);
  return cropCanvasToTrimmedPng(canvas, 16);
}
