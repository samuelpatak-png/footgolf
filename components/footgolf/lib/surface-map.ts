import type { SurfaceType, SurfaceZone, WaterHazard, ZoneShape } from "./types";

/**
 * Signed "insideness" distance for a shape: positive inside (magnitude =
 * distance to the boundary), negative outside. Not a mathematically perfect
 * SDF for every shape, but monotonic near the boundary which is all that's
 * needed to smoothly blend ground textures / hazard edges.
 */
export function shapeInsideDistance(shape: ZoneShape, x: number, z: number): number {
  switch (shape.type) {
    case "circle": {
      const dx = x - shape.center[0];
      const dz = z - shape.center[1];
      return shape.radius - Math.hypot(dx, dz);
    }
    case "ellipse": {
      const rot = shape.rotation ?? 0;
      const dx = x - shape.center[0];
      const dz = z - shape.center[1];
      const cos = Math.cos(-rot);
      const sin = Math.sin(-rot);
      const lx = dx * cos - dz * sin;
      const lz = dx * sin + dz * cos;
      const norm = Math.hypot(lx / shape.radiusX, lz / shape.radiusZ);
      const avgR = (shape.radiusX + shape.radiusZ) / 2;
      return (1 - norm) * avgR;
    }
    case "rect": {
      const rot = shape.rotation ?? 0;
      const dx = x - shape.center[0];
      const dz = z - shape.center[1];
      const cos = Math.cos(-rot);
      const sin = Math.sin(-rot);
      const lx = dx * cos - dz * sin;
      const lz = dx * sin + dz * cos;
      const hx = shape.size[0] / 2;
      const hz = shape.size[1] / 2;
      const qx = Math.abs(lx) - hx;
      const qz = Math.abs(lz) - hz;
      const outsideDist = Math.hypot(Math.max(qx, 0), Math.max(qz, 0));
      const insideDist = Math.min(Math.max(qx, qz), 0);
      return -(outsideDist + insideDist);
    }
    case "polygon": {
      const pts = shape.points;
      let minDist = Infinity;
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, zi] = pts[i];
        const [xj, zj] = pts[j];
        minDist = Math.min(minDist, segDist(x, z, xi, zi, xj, zj));
        const intersects = zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi;
        if (intersects) inside = !inside;
      }
      return inside ? minDist : -minDist;
    }
  }
}

function segDist(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  const lenSq = dx * dx + dz * dz;
  let t = lenSq > 0 ? ((px - ax) * dx + (pz - az) * dz) / lenSq : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}

export function pointInShape(shape: ZoneShape, x: number, z: number): boolean {
  return shapeInsideDistance(shape, x, z) >= 0;
}

/** Discrete surface lookup (highest priority zone containing the point wins). */
export function surfaceAt(zones: SurfaceZone[], x: number, z: number, fallback: SurfaceType = "rough"): SurfaceType {
  let best: { surface: SurfaceType; priority: number } | null = null;
  for (const zone of zones) {
    if (!pointInShape(zone.shape, x, z)) continue;
    const priority = zone.priority ?? 0;
    if (!best || priority >= best.priority) best = { surface: zone.surface, priority };
  }
  return best?.surface ?? fallback;
}

export function isInWaterHazard(hazards: WaterHazard[], x: number, z: number): WaterHazard | null {
  for (const hazard of hazards) {
    if (pointInShape(hazard.shape, x, z)) return hazard;
  }
  return null;
}

/** Smooth 0..1 blend weight, ramping up over `blendDist` world units inside a shape's edge. */
export function edgeBlendWeight(shape: ZoneShape, x: number, z: number, blendDist = 1.4): number {
  const d = shapeInsideDistance(shape, x, z);
  const t = Math.max(0, Math.min(1, d / blendDist));
  return t * t * (3 - 2 * t);
}

export interface GroundBlendWeights {
  rough: number;
  sand: number;
  green: number;
}

/**
 * Per-vertex texture blend weights for the terrain shader: base layer is
 * fairway grass, with rough / sand / green layers painted on top wherever
 * their zones (with smooth-blended edges) say so.
 */
export function groundBlendWeightsAt(zones: SurfaceZone[], x: number, z: number): GroundBlendWeights {
  let rough = 0;
  let sand = 0;
  let green = 0;
  for (const zone of zones) {
    const w = edgeBlendWeight(zone.shape, x, z);
    if (w <= 0) continue;
    if (zone.surface === "rough") rough = Math.max(rough, w);
    else if (zone.surface === "sand") sand = Math.max(sand, w);
    else if (zone.surface === "green" || zone.surface === "tee") green = Math.max(green, w);
  }
  return { rough, sand, green };
}

export const SURFACE_FRICTION: Record<SurfaceType, number> = {
  tee: 0.55,
  fairway: 0.65,
  green: 0.4,
  rough: 1.55,
  sand: 2.6,
  water: 0.8,
  cartpath: 0.35,
};

// High enough that even on the gentlest course-wide slope the ball's terminal
// rolling speed decays below the settle thresholds in course.tsx instead of
// reaching a nonzero steady-state creep (constant grade + purely velocity-
// proportional damping otherwise never actually reaches zero).
export const SURFACE_DAMPING: Record<SurfaceType, number> = {
  tee: 0.55,
  fairway: 0.7,
  green: 0.35,
  rough: 1.6,
  sand: 2.8,
  water: 0.3,
  cartpath: 0.4,
};
