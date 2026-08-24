"use client";

import * as THREE from "three";

/**
 * Procedural ground + ball textures, drawn once on an offscreen canvas.
 * Keeping this deterministic (seeded PRNG, no Math.random()) means the
 * grain pattern is stable no matter how many times a hole gets remounted,
 * and there is zero network/asset dependency — everything is code-generated.
 */

/** Deterministic PRNG (mulberry32) so a texture's grain never changes between calls. */
function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp255(v: number): number {
  return Math.max(0, Math.min(255, v));
}

function createCanvas(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("footgolf textures: 2D canvas context unavailable");
  }
  return { canvas, ctx };
}

/** Ground materials tile across a whole hole, so these get real RepeatWrapping. */
function toTiledTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/**
 * Adds correlated (not per-channel-independent) per-pixel grain around the
 * canvas's existing colors, so noise reads as fine grass/sand texture
 * rather than RGB static.
 */
function addGrain(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  rng: () => number,
  amount: number
): void {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const n = (rng() - 0.5) * 2 * amount;
    data[i] = clamp255(data[i] + n);
    data[i + 1] = clamp255(data[i + 1] + n * 0.92);
    data[i + 2] = clamp255(data[i + 2] + n * 0.85);
  }
  ctx.putImageData(imageData, 0, 0);
}

/**
 * Invokes `draw` once at (x, y) and again at any wrapped offset(s) needed so
 * a feature straddling a canvas edge still tiles cleanly under
 * RepeatWrapping instead of getting clipped into a visible seam.
 */
function drawWrapped(
  x: number,
  y: number,
  margin: number,
  width: number,
  height: number,
  draw: (x: number, y: number) => void
): void {
  const offsetsX = [0];
  if (x < margin) offsetsX.push(width);
  if (x > width - margin) offsetsX.push(-width);
  const offsetsY = [0];
  if (y < margin) offsetsY.push(height);
  if (y > height - margin) offsetsY.push(-height);
  for (const ox of offsetsX) {
    for (const oy of offsetsY) {
      draw(x + ox, y + oy);
    }
  }
}

/** Flat-shaded horizontal mowing bands, evenly divided so they repeat seamlessly. */
function drawMowStripes(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  stripeCount: number,
  base: readonly [number, number, number],
  delta: number
): void {
  const stripeHeight = height / stripeCount;
  for (let i = 0; i < stripeCount; i++) {
    const d = i % 2 === 0 ? delta : -delta;
    ctx.fillStyle = `rgb(${clamp255(base[0] + d)}, ${clamp255(base[1] + d)}, ${clamp255(base[2] + d)})`;
    // +1px overdraw hides sub-pixel rounding gaps between bands.
    ctx.fillRect(0, Math.floor(i * stripeHeight), width, Math.ceil(stripeHeight) + 1);
  }
}

const FAIRWAY_BASE: readonly [number, number, number] = [74, 156, 63];
const ROUGH_BASE: readonly [number, number, number] = [58, 95, 46];
const SAND_BASE: readonly [number, number, number] = [217, 196, 139];
const GREEN_BASE: readonly [number, number, number] = [92, 179, 90];

export function createFairwayTexture(): THREE.Texture {
  const size = 448;
  const { canvas, ctx } = createCanvas(size, size);
  const rng = seededRng(0x4a9c3f);

  ctx.fillStyle = `rgb(${FAIRWAY_BASE[0]}, ${FAIRWAY_BASE[1]}, ${FAIRWAY_BASE[2]})`;
  ctx.fillRect(0, 0, size, size);

  // Broadcast-style mower stripes: wide alternating light/dark bands.
  drawMowStripes(ctx, size, size, 8, FAIRWAY_BASE, 9);

  // A handful of soft, larger mottled patches so the stripes don't look printed-on.
  for (let i = 0; i < 26; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const radius = 14 + rng() * 22;
    const shade = (rng() - 0.5) * 14;
    drawWrapped(x, y, radius, size, size, (wx, wy) => {
      const gradient = ctx.createRadialGradient(wx, wy, 0, wx, wy, radius);
      gradient.addColorStop(0, `rgba(${clamp255(FAIRWAY_BASE[0] + shade)}, ${clamp255(FAIRWAY_BASE[1] + shade)}, ${clamp255(FAIRWAY_BASE[2] + shade)}, 0.18)`);
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(wx - radius, wy - radius, radius * 2, radius * 2);
    });
  }

  addGrain(ctx, size, size, rng, 7);

  return toTiledTexture(canvas);
}

export function createRoughTexture(): THREE.Texture {
  const size = 448;
  const { canvas, ctx } = createCanvas(size, size);
  const rng = seededRng(0x3a5f2e);

  ctx.fillStyle = `rgb(${ROUGH_BASE[0]}, ${ROUGH_BASE[1]}, ${ROUGH_BASE[2]})`;
  ctx.fillRect(0, 0, size, size);

  // Coarse, uneven blotches — no mowing pattern, deliberately less uniform than fairway.
  for (let i = 0; i < 60; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const radius = 10 + rng() * 34;
    const lighter = rng() > 0.5;
    const shade = (10 + rng() * 22) * (lighter ? 1 : -1);
    const alpha = 0.12 + rng() * 0.16;
    drawWrapped(x, y, radius, size, size, (wx, wy) => {
      const gradient = ctx.createRadialGradient(wx, wy, 0, wx, wy, radius);
      gradient.addColorStop(0, `rgba(${clamp255(ROUGH_BASE[0] + shade)}, ${clamp255(ROUGH_BASE[1] + shade)}, ${clamp255(ROUGH_BASE[2] + shade)}, ${alpha})`);
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(wx - radius, wy - radius, radius * 2, radius * 2);
    });
  }

  // Short random streaks suggesting uncut, wind-blown grass blades.
  ctx.lineCap = "round";
  for (let i = 0; i < 420; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const len = 3 + rng() * 7;
    const angle = rng() * Math.PI * 2;
    const dx = Math.cos(angle) * len;
    const dz = Math.sin(angle) * len;
    const lighter = rng() > 0.45;
    const shade = (14 + rng() * 20) * (lighter ? 1 : -1);
    ctx.strokeStyle = `rgba(${clamp255(ROUGH_BASE[0] + shade)}, ${clamp255(ROUGH_BASE[1] + shade)}, ${clamp255(ROUGH_BASE[2] + shade)}, 0.35)`;
    ctx.lineWidth = 0.6 + rng() * 0.8;
    drawWrapped(x, y, len, size, size, (wx, wy) => {
      ctx.beginPath();
      ctx.moveTo(wx, wy);
      ctx.lineTo(wx + dx, wy + dz);
      ctx.stroke();
    });
  }

  addGrain(ctx, size, size, rng, 12);

  return toTiledTexture(canvas);
}

export function createSandTexture(): THREE.Texture {
  const size = 384;
  const { canvas, ctx } = createCanvas(size, size);
  const rng = seededRng(0xd9c48b);

  ctx.fillStyle = `rgb(${SAND_BASE[0]}, ${SAND_BASE[1]}, ${SAND_BASE[2]})`;
  ctx.fillRect(0, 0, size, size);

  addGrain(ctx, size, size, rng, 9);

  // Gently wavy raked lines, evenly spaced vertically so they tile seamlessly,
  // and one full sine period across the width so they tile horizontally too.
  const lineCount = 9;
  const spacing = size / lineCount;
  const cycles = 2;
  ctx.lineCap = "round";
  for (let i = 0; i < lineCount; i++) {
    const baseY = i * spacing + spacing / 2;
    const amplitude = 4 + rng() * 3;
    const phase = rng() * Math.PI * 2;

    for (let pass = 0; pass < 2; pass++) {
      const dark = pass === 0;
      ctx.strokeStyle = dark
        ? `rgba(${clamp255(SAND_BASE[0] - 26)}, ${clamp255(SAND_BASE[1] - 24)}, ${clamp255(SAND_BASE[2] - 20)}, 0.3)`
        : `rgba(${clamp255(SAND_BASE[0] + 22)}, ${clamp255(SAND_BASE[1] + 20)}, ${clamp255(SAND_BASE[2] + 16)}, 0.25)`;
      ctx.lineWidth = dark ? 1.6 : 1.1;
      const yOffset = dark ? 1.4 : -1.4;

      ctx.beginPath();
      const steps = 64;
      for (let s = 0; s <= steps; s++) {
        const x = (s / steps) * size;
        const y = baseY + yOffset + Math.sin((x / size) * Math.PI * 2 * cycles + phase) * amplitude;
        if (s === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  return toTiledTexture(canvas);
}

export function createGreenTexture(): THREE.Texture {
  const size = 384;
  const { canvas, ctx } = createCanvas(size, size);
  const rng = seededRng(0x5cb35a);

  ctx.fillStyle = `rgb(${GREEN_BASE[0]}, ${GREEN_BASE[1]}, ${GREEN_BASE[2]})`;
  ctx.fillRect(0, 0, size, size);

  // Tight, fine mowing pattern — a manicured putting green, much finer than the fairway.
  drawMowStripes(ctx, size, size, 18, GREEN_BASE, 4);

  // Greens are near-smooth: only a whisper of grain.
  addGrain(ctx, size, size, rng, 3);

  return toTiledTexture(canvas);
}

/** Vertex offsets (relative to center) for a hand-jittered pentagon/hexagon-ish patch. */
function ballPatchPoints(radius: number, sides: number, rotation: number, rng: () => number): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  for (let i = 0; i < sides; i++) {
    const angle = rotation + (i / sides) * Math.PI * 2;
    const r = radius * (0.85 + rng() * 0.3);
    points.push([Math.cos(angle) * r, Math.sin(angle) * r]);
  }
  return points;
}

/** Fills a patch's precomputed outline translated to (cx, cy) — reused for seam wraparound copies. */
function fillPatch(ctx: CanvasRenderingContext2D, cx: number, cy: number, points: ReadonlyArray<[number, number]>): void {
  ctx.beginPath();
  points.forEach(([dx, dy], i) => {
    const x = cx + dx;
    const y = cy + dy;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fill();
}

export function createSoccerBallTexture(): THREE.Texture {
  const width = 512;
  const height = 256;
  const { canvas, ctx } = createCanvas(width, height);
  const rng = seededRng(0x0b0b0b);

  ctx.fillStyle = "#f5f5f2";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#141414";

  interface Patch {
    cx: number;
    cy: number;
    radius: number;
    sides: number;
  }

  const patches: Patch[] = [];

  // Two patches near each pole.
  for (const poleY of [1, -1]) {
    for (let i = 0; i < 2; i++) {
      const cx = (0.3 + i * 0.45 + rng() * 0.1) * width;
      const cy = poleY > 0 ? 18 + rng() * 18 : height - (18 + rng() * 18);
      patches.push({ cx, cy, radius: 20 + rng() * 8, sides: 5 });
    }
  }

  // Mid-latitude ring, between each pole and the equator.
  for (const band of [0.32, 0.68]) {
    for (let i = 0; i < 4; i++) {
      const cx = ((i + rng() * 0.6) / 4) * width;
      const cy = band * height + (rng() - 0.5) * 20;
      patches.push({ cx, cy, radius: 20 + rng() * 9, sides: rng() > 0.5 ? 6 : 5 });
    }
  }

  // Equatorial ring.
  for (let i = 0; i < 6; i++) {
    const cx = ((i + rng() * 0.5) / 6) * width;
    const cy = height / 2 + (rng() - 0.5) * 18;
    patches.push({ cx, cy, radius: 22 + rng() * 9, sides: 6 });
  }

  for (const patch of patches) {
    const rotation = rng() * Math.PI * 2;
    const points = ballPatchPoints(patch.radius, patch.sides, rotation, rng);
    // Only wrap horizontally: the sphere's UV seam joins u=0 to u=1 (left/right
    // edges), but the top/bottom edges are distinct poles, not a seam.
    const xs = [patch.cx];
    if (patch.cx < patch.radius) xs.push(patch.cx + width);
    if (patch.cx > width - patch.radius) xs.push(patch.cx - width);
    for (const x of xs) {
      fillPatch(ctx, x, patch.cy, points);
    }
  }

  // Thin light-grey seam lines curving across the panels.
  ctx.strokeStyle = "rgba(205, 205, 200, 0.4)";
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 5; i++) {
    const baseY = (i + 0.5) * (height / 5);
    const amplitude = 10 + rng() * 12;
    const phase = rng() * Math.PI * 2;
    ctx.beginPath();
    const steps = 48;
    for (let s = 0; s <= steps; s++) {
      const x = (s / steps) * width;
      const y = baseY + Math.sin((x / width) * Math.PI * 2 + phase) * amplitude;
      if (s === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Subtle darkening toward the pole regions (top/bottom edges) for extra depth.
  const topShade = ctx.createLinearGradient(0, 0, 0, height * 0.18);
  topShade.addColorStop(0, "rgba(0, 0, 0, 0.22)");
  topShade.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = topShade;
  ctx.fillRect(0, 0, width, height * 0.18);

  const bottomShade = ctx.createLinearGradient(0, height * 0.82, 0, height);
  bottomShade.addColorStop(0, "rgba(0, 0, 0, 0)");
  bottomShade.addColorStop(1, "rgba(0, 0, 0, 0.22)");
  ctx.fillStyle = bottomShade;
  ctx.fillRect(0, height * 0.82, width, height * 0.18);

  // Not tiled: this maps once onto a UV sphere, so leave the default ClampToEdgeWrapping.
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
