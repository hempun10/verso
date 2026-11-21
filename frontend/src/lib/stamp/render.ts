import { cropCanvasToTrimmedPng } from "@/lib/canvas";
import { applyRubberInkDistress } from "./distress";
import { drawStar, drawTintedMask } from "./primitives";
import { drawCircleSeal, drawOvalSeal } from "./seals";
import {
  formatStampDate,
  getStampCanvasSize,
  type StampConfig,
} from "./types";

function drawRectStamp(
  ctx: CanvasRenderingContext2D,
  maskImg: HTMLImageElement | null,
  config: StampConfig,
  cx: number,
  cy: number,
  dateStr: string,
) {
  const { width, height } = ctx.canvas;
  const pad = 42;
  const bw = width - pad * 2;
  const bh = height - pad * 2;
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
  const innerRight = width - pad - 48;
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

    const divX = innerLeft + boxW + 28;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(divX, pad + 56);
    ctx.lineTo(divX, height - pad - 56);
    ctx.stroke();

    textCenterX = (divX + 24 + innerRight) / 2;
    textMaxW = innerRight - (divX + 36);
  }

  const title = config.topText.trim().toUpperCase();
  const subtitle = config.bottomText.trim().toUpperCase();
  const rows: { text: string; font: string; y: number }[] = [];

  if (title && subtitle && config.showDate) {
    rows.push({
      text: title,
      font: '800 58px Georgia, "Times New Roman", serif',
      y: cy - 84,
    });
    rows.push({
      text: subtitle,
      font: '700 32px Georgia, "Times New Roman", serif',
      y: cy + 4,
    });
    rows.push({
      text: dateStr,
      font: '700 34px "Courier New", monospace',
      y: cy + 84,
    });
  } else if (title && (subtitle || config.showDate)) {
    rows.push({
      text: title,
      font: '800 62px Georgia, "Times New Roman", serif',
      y: cy - 48,
    });
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
      const maxDim =
        Math.min(canvas.width, canvas.height) * 0.78 * config.logoScale;
      const aspect = maskImg.naturalWidth / Math.max(1, maskImg.naturalHeight);
      const dw = aspect >= 1 ? maxDim : maxDim * aspect;
      const dh = aspect >= 1 ? maxDim / aspect : maxDim;
      drawTintedMask(
        ctx,
        maskImg,
        cx - dw / 2,
        cy - dh / 2,
        dw,
        dh,
        config.inkColor,
      );
    }
  } else if (config.template === "circle") {
    drawCircleSeal(ctx, maskImg, config, cx, cy, dateStr);
  } else if (config.template === "oval") {
    drawOvalSeal(ctx, maskImg, config, cx, cy, dateStr);
  } else if (config.template === "rect") {
    drawRectStamp(ctx, maskImg, config, cx, cy, dateStr);
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
