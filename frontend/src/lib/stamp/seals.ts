import {
  drawCircularArcText,
  drawEllipticalArcText,
  drawNotaryRing,
  drawStar,
  drawTintedMask,
} from "./primitives";
import type { StampConfig } from "./types";

export function drawCircleSeal(
  ctx: CanvasRenderingContext2D,
  maskImg: HTMLImageElement | null,
  config: StampConfig,
  cx: number,
  cy: number,
  dateStr: string,
) {
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
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(cx, cy, outerR - 20, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(cx, cy, innerRingR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(cx, cy, innerRingR - 12, 0, Math.PI * 2);
  ctx.stroke();

  drawCircularArcText(ctx, config.topText, cx, cy, textR, false, 2.55, 58);
  drawCircularArcText(ctx, config.bottomText, cx, cy, textR, true, 2.35, 52);

  if (config.showStars) {
    drawStar(ctx, cx - textR, cy, 18, 7.5);
    drawStar(ctx, cx + textR, cy, 18, 7.5);
  }

  if (maskImg) {
    const avail = (innerRingR - 30) * 1.62 * config.logoScale;
    const maxH = config.showDate ? avail * 0.72 : avail;
    const aspect = maskImg.naturalWidth / Math.max(1, maskImg.naturalHeight);
    let dw = avail;
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
}

export function drawOvalSeal(
  ctx: CanvasRenderingContext2D,
  maskImg: HTMLImageElement | null,
  config: StampConfig,
  cx: number,
  cy: number,
  dateStr: string,
) {
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
    const maxH =
      (config.showDate ? innerRy * 0.92 : innerRy * 1.45) * config.logoScale;
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
}
