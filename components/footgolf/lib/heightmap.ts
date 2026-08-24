import type { TerrainFeature, Vec2 } from "./types";

/** Cheap deterministic value-noise (no external deps) for subtle terrain roughness. */
function hash2(x: number, z: number, seed: number): number {
  const s = Math.sin(x * 127.1 + z * 311.7 + seed * 74.7) * 43758.5453123;
  return s - Math.floor(s);
}

function valueNoise(x: number, z: number, seed: number): number {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = x - xi;
  const zf = z - zi;
  const a = hash2(xi, zi, seed);
  const b = hash2(xi + 1, zi, seed);
  const c = hash2(xi, zi + 1, seed);
  const d = hash2(xi + 1, zi + 1, seed);
  const u = xf * xf * (3 - 2 * xf);
  const v = zf * zf * (3 - 2 * zf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x: number, z: number, seed: number, octaves = 3): number {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * (valueNoise(x * freq, z * freq, seed + i * 17.13) * 2 - 1);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return norm > 0 ? sum / norm : 0;
}

/** Smooth 0..1 falloff, 1 at d2=0, 0 at d2>=1, C1 continuous at the edge. */
function radialFalloff(d2: number): number {
  if (d2 >= 1) return 0;
  const t = 1 - d2;
  return t * t * (3 - 2 * t);
}

function distToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  const lenSq = dx * dx + dz * dz;
  let t = lenSq > 0 ? ((px - ax) * dx + (pz - az) * dz) / lenSq : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cz = az + t * dz;
  return Math.hypot(px - cx, pz - cz);
}

/**
 * Builds a height(x, z) -> y sampler from a list of additive terrain features.
 * Used identically to build the visual mesh and the physics heightfield so
 * they can never disagree about where the ground is.
 */
export function createHeightSampler(features: TerrainFeature[], baseHeight: number) {
  return function heightAt(x: number, z: number): number {
    let y = baseHeight;
    for (const f of features) {
      switch (f.kind) {
        case "bump": {
          const dx = x - f.center[0];
          const dz = z - f.center[1];
          const nx = dx / f.radiusX;
          const nz = dz / f.radiusZ;
          const d2 = nx * nx + nz * nz;
          y += f.height * radialFalloff(d2);
          break;
        }
        case "ridge": {
          const dist = distToSegment(x, z, f.from[0], f.from[1], f.to[0], f.to[1]);
          const d2 = (dist / f.width) * (dist / f.width);
          y += f.height * radialFalloff(d2);
          break;
        }
        case "slope": {
          const len = Math.hypot(f.dir[0], f.dir[1]) || 1;
          y += (x * (f.dir[0] / len) + z * (f.dir[1] / len)) * f.strength;
          break;
        }
        case "noise": {
          y += fbm(x * f.frequency, z * f.frequency, f.seed ?? 0) * f.amplitude;
          break;
        }
      }
    }
    return y;
  };
}

export type HeightSampler = ReturnType<typeof createHeightSampler>;

/** Central difference surface normal, used for prop placement (align to slope) and debug. */
export function heightNormal(heightAt: HeightSampler, x: number, z: number, eps = 0.15): Vec2 {
  const hL = heightAt(x - eps, z);
  const hR = heightAt(x + eps, z);
  const hD = heightAt(x, z - eps);
  const hU = heightAt(x, z + eps);
  return [(hL - hR) / (2 * eps), (hD - hU) / (2 * eps)];
}
