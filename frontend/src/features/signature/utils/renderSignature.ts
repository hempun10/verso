import { cropCanvasToTrimmedPng } from "@/lib/canvas";

export function renderTypedSignaturePng(
  text: string,
  fontCss: string,
  color: string,
): { dataUrl: string; width: number; height: number } | null {
  const clean = text.trim();
  if (!clean) return null;
  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 220;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(2, 2);
  ctx.font = fontCss;
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.fillText(clean, 20, 55);
  return cropCanvasToTrimmedPng(canvas, 12);
}
