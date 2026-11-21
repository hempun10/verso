/** Deterministic procedural rubber-ink distress & uneven hand-press texture pass. */

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

export function applyRubberInkDistress(
  ctx: CanvasRenderingContext2D,
  distress: number,
  seed: number,
) {
  if (distress <= 0) return;
  const { width, height } = ctx.canvas;
  const img = ctx.getImageData(0, 0, width, height);
  const data = img.data;
  const strength = Math.min(1, Math.max(0, distress / 100));

  const pressAngle = hash2d(17, 31, seed) * Math.PI * 2;
  const pdx = Math.cos(pressAngle);
  const pdy = Math.sin(pressAngle);

  for (let y = 0; y < height; y++) {
    const ny = (y / height - 0.5) * 2;
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4 + 3;
      const a = data[idx]!;
      if (a === 0) continue;

      const nx = (x / width - 0.5) * 2;
      const press =
        1.0 - strength * 0.18 * Math.max(0, nx * pdx + ny * pdy + 0.35);

      const grain =
        smoothNoise(x * 0.24, y * 0.24, seed + 1) * 0.52 +
        smoothNoise(x * 0.055, y * 0.055, seed + 7) * 0.33 +
        smoothNoise(x * 0.016, y * 0.016, seed + 23) * 0.15;

      const cutoff = 0.14 + strength * 0.36;
      let inkFactor = 0.92 + grain * 0.08;
      if (grain < cutoff) {
        const drop = (cutoff - grain) / Math.max(0.08, cutoff);
        inkFactor = Math.max(0.06, 1.0 - drop * (0.65 + strength * 0.45));
      }

      data[idx] = Math.max(0, Math.min(255, Math.round(a * press * inkFactor)));
    }
  }

  ctx.putImageData(img, 0, 0);
}
