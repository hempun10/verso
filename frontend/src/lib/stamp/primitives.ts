/** Low-level Canvas 2D drawing primitives for official stamps and curved arc text. */

export function drawTintedMask(
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

export function drawStar(
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

export function drawCircularArcText(
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

export function drawEllipticalArcText(
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

  const stepAngle = (t: number, arcLen: number) => {
    const ds = Math.hypot(-rx * Math.sin(t), ry * Math.cos(t));
    return arcLen / Math.max(1, ds);
  };

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (!isBottom) {
    let t = -Math.PI / 2;
    for (let s = 0; s < 20; s++) t -= stepAngle(t, totalW / 40);
    for (let i = 0; i < chars.length; i++) {
      const mid = t + stepAngle(t, widths[i]! / 2);
      const tangent = Math.atan2(ry * Math.cos(mid), -rx * Math.sin(mid));
      ctx.save();
      ctx.translate(cx + Math.cos(mid) * rx, cy + Math.sin(mid) * ry);
      ctx.rotate(tangent);
      ctx.fillText(chars[i]!, 0, 0);
      ctx.restore();
      t = mid + stepAngle(mid, widths[i]! / 2 + tracking);
    }
  } else {
    let t = Math.PI / 2;
    for (let s = 0; s < 20; s++) t += stepAngle(t, totalW / 40);
    for (let i = 0; i < chars.length; i++) {
      const mid = t - stepAngle(t, widths[i]! / 2);
      const tangent =
        Math.atan2(ry * Math.cos(mid), -rx * Math.sin(mid)) + Math.PI;
      ctx.save();
      ctx.translate(cx + Math.cos(mid) * rx, cy + Math.sin(mid) * ry);
      ctx.rotate(tangent);
      ctx.fillText(chars[i]!, 0, 0);
      ctx.restore();
      t = mid - stepAngle(mid, widths[i]! / 2 + tracking);
    }
  }
}

export function drawNotaryRing(
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
