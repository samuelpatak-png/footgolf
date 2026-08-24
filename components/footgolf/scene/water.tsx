"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { MeshReflectorMaterial } from "@react-three/drei";
import type { ZoneShape } from "../lib/types";

/**
 * Renders one water hazard (pond/lake) as a flat, horizontal, reflective
 * water surface. Shape/size/position come from a `ZoneShape` (shared with
 * surface-zone classification, so the visual footprint always matches where
 * the ball actually gets treated as "water"). Everything is procedural —
 * primitive geometry plus a tiny canvas-drawn ripple texture — no external
 * assets.
 */

const WATER_COLOR = "#2c6e7a";

// A few millimeters of slow vertical bob so the surface never reads as a
// perfectly static, frozen plane.
const BOB_AMPLITUDE = 0.004;
const BOB_SPEED = 0.35;

/** Deterministic mulberry32 PRNG so the ripple texture's grain never changes between mounts. */
function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Cheap deterministic 0..1 hash for a per-pond animation phase (stable, not Math.random()). */
function hash01(n: number): number {
  const s = Math.sin(n) * 43758.5453123;
  return s - Math.floor(s);
}

interface FlatWaterGeometry {
  geometry: THREE.BufferGeometry;
  /** Local XZ offset to apply to the mesh (Y is always 0 — the water level is handled separately). */
  position: readonly [number, number, number];
  scale: readonly [number, number, number];
  rotationY: number;
}

/**
 * Builds a single flat mesh footprint (already lying in the XZ plane) for a
 * `ZoneShape`, handling all four variants. The water level (world-space Y)
 * is intentionally not baked in here — the caller positions the whole
 * group at `level` so the same geometry can be reused for the reflective
 * surface and the subtle ripple overlay above it.
 */
function buildFlatGeometry(shape: ZoneShape): FlatWaterGeometry {
  switch (shape.type) {
    case "circle": {
      const geometry = new THREE.CircleGeometry(shape.radius, 48);
      geometry.rotateX(-Math.PI / 2);
      return {
        geometry,
        position: [shape.center[0], 0, shape.center[1]],
        scale: [1, 1, 1],
        rotationY: 0,
      };
    }
    case "ellipse": {
      // Unit circle, flattened once; radiusX/radiusZ are applied as a
      // non-uniform XZ scale on the mesh itself (scale's Y stays 1, so the
      // flat surface's up-normal is unaffected).
      const geometry = new THREE.CircleGeometry(1, 64);
      geometry.rotateX(-Math.PI / 2);
      return {
        geometry,
        position: [shape.center[0], 0, shape.center[1]],
        scale: [shape.radiusX, 1, shape.radiusZ],
        rotationY: shape.rotation ?? 0,
      };
    }
    case "rect": {
      const geometry = new THREE.PlaneGeometry(shape.size[0], shape.size[1]);
      geometry.rotateX(-Math.PI / 2);
      geometry.rotateY(shape.rotation ?? 0);
      return {
        geometry,
        position: [shape.center[0], 0, shape.center[1]],
        scale: [1, 1, 1],
        rotationY: 0,
      };
    }
    case "polygon": {
      const outline = new THREE.Shape();
      // Shape() is authored in an XY plane; feed it (x, -z) so that after the
      // -90deg-about-X flattening rotation below (which maps local Y -> world
      // -Z) the resulting world Z lands back on each point's original z, and
      // the footprint ends up exactly where `points` describes it in world
      // space (points are already absolute world XZ, no extra translation).
      shape.points.forEach(([x, z], i) => {
        if (i === 0) outline.moveTo(x, -z);
        else outline.lineTo(x, -z);
      });
      outline.closePath();
      const geometry = new THREE.ShapeGeometry(outline);
      geometry.rotateX(-Math.PI / 2);
      return {
        geometry,
        position: [0, 0, 0],
        scale: [1, 1, 1],
        rotationY: 0,
      };
    }
  }
}

/**
 * Small procedural, alpha-only canvas texture: sparse soft pale blobs plus a
 * few faint arcs, simulating gentle ripple/foam highlights. Blended
 * additively over the reflective surface for a touch of extra richness. No
 * network/asset dependency — drawn once on an offscreen canvas.
 */
function createRippleTexture(): THREE.Texture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("footgolf water: 2D canvas context unavailable");
  }

  const rng = seededRng(0x9e3779b9);

  for (let i = 0; i < 46; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const radius = 6 + rng() * 22;
    const alpha = 0.05 + rng() * 0.16;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(x, y, radius, radius * (0.4 + rng() * 0.4), rng() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.lineCap = "round";
  for (let i = 0; i < 10; i++) {
    const cx = rng() * size;
    const cy = rng() * size;
    const radius = 10 + rng() * 30;
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.06 + rng() * 0.08})`;
    ctx.lineWidth = 0.8 + rng() * 0.8;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, rng() * Math.PI * 2, rng() * Math.PI * 2);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

interface WaterProps {
  shape: ZoneShape;
  level: number;
}

export function Water({ shape, level }: WaterProps): JSX.Element {
  const groupRef = useRef<THREE.Group>(null);

  const flat = useMemo(() => buildFlatGeometry(shape), [shape]);
  const rippleTexture = useMemo(() => createRippleTexture(), []);

  // Deterministic per-pond phase (seeded from its own footprint + level) so
  // multiple ponds on a hole don't bob perfectly in lockstep.
  const bobPhase = useMemo(
    () => hash01(flat.position[0] * 12.9898 + flat.position[2] * 78.233 + level * 37.1) * Math.PI * 2,
    [flat.position, level]
  );

  useFrame((state) => {
    const group = groupRef.current;
    if (!group) return;
    group.position.y = level + Math.sin(state.clock.elapsedTime * BOB_SPEED + bobPhase) * BOB_AMPLITUDE;
  });

  return (
    <group ref={groupRef} position={[0, level, 0]}>
      <mesh geometry={flat.geometry} position={flat.position} rotation={[0, flat.rotationY, 0]} scale={flat.scale} receiveShadow>
        <MeshReflectorMaterial
          mirror={0}
          blur={[300, 100]}
          resolution={512}
          mixBlur={0.7}
          mixStrength={35}
          roughness={0.7}
          depthScale={0.3}
          minDepthThreshold={0.85}
          maxDepthThreshold={1.4}
          metalness={0.15}
          color={WATER_COLOR}
          transparent
          opacity={0.92}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Subtle translucent ripple/foam overlay, riding just above the reflective surface. */}
      <mesh
        geometry={flat.geometry}
        position={[flat.position[0], flat.position[1] + 0.012, flat.position[2]]}
        rotation={[0, flat.rotationY, 0]}
        scale={flat.scale}
      >
        <meshBasicMaterial
          map={rippleTexture}
          transparent
          opacity={0.35}
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}
