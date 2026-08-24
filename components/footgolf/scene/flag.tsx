"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { Vec2 } from "../lib/types";
import type { HeightSampler } from "../lib/heightmap";

/**
 * The pin: a recessed cup (dark open cylinder + dark bottom cap + a white
 * rim ring so it reads clearly from a distance) plus a flagstick topped
 * with a low-poly triangular pennant that ripples via a per-frame sine
 * displacement of its vertex positions — a simple CPU "cloth" update, no
 * simulation library. Everything is procedural geometry/materials, no
 * external assets.
 */

const POLE_TOP_RADIUS = 0.014;
const POLE_BOTTOM_RADIUS = 0.02;
const FLAG_WIDTH = 0.55;
const FLAG_HEIGHT = 0.32;
const FLAG_SEGMENTS_X = 6;
const FLAG_SEGMENTS_Y = 3;

/** Cheap deterministic 0..1 hash, seeded from stable inputs — never Math.random(). */
function hash(seed: number, salt: number): number {
  const s = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453123;
  return s - Math.floor(s);
}

interface CupProps {
  cupRadius: number;
}

/** The hole itself: a dark recessed cylinder, a dark bottom cap, and a bright rim ring. */
function Cup({ cupRadius }: CupProps): JSX.Element {
  const depth = cupRadius * 0.8;
  const inset = 0.015;
  const rimTube = Math.max(cupRadius * 0.07, 0.018);

  const wallGeometry = useMemo(
    () => new THREE.CylinderGeometry(cupRadius, cupRadius, depth, 20, 1, true),
    [cupRadius, depth]
  );
  const bottomGeometry = useMemo(() => new THREE.CircleGeometry(cupRadius, 20), [cupRadius]);
  const rimGeometry = useMemo(() => new THREE.TorusGeometry(cupRadius, rimTube, 8, 32), [cupRadius, rimTube]);

  // The wall's top sits just below y=0 so it reads as recessed instead of
  // z-fighting with the terrain mesh at the pin's exact position.
  const wallTopY = -inset;
  const wallCenterY = wallTopY - depth / 2;
  const bottomY = wallTopY - depth;

  return (
    <group>
      <mesh geometry={wallGeometry} position={[0, wallCenterY, 0]} receiveShadow>
        <meshStandardMaterial color="#0c0c0c" roughness={0.95} metalness={0} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={bottomGeometry} position={[0, bottomY, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <meshStandardMaterial color="#050505" roughness={1} metalness={0} />
      </mesh>
      <mesh geometry={rimGeometry} position={[0, 0.006, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#f4f2ea" roughness={0.55} metalness={0.05} />
      </mesh>
    </group>
  );
}

interface PennantProps {
  poleHeight: number;
}

/**
 * A low-poly triangular pennant. The geometry (a tapered plane) is built
 * once via useMemo; each frame its Z offsets are recomputed fresh from the
 * ORIGINAL flat vertex positions plus a sine wave — never accumulated onto
 * the live positions — so the ripple stays a stable, bounded wave instead
 * of drifting or blowing up over time.
 */
function Pennant({ poleHeight }: PennantProps): JSX.Element {
  const meshRef = useRef<THREE.Mesh>(null);

  const { geometry, basePositions } = useMemo(() => {
    const geo = new THREE.PlaneGeometry(FLAG_WIDTH, FLAG_HEIGHT, FLAG_SEGMENTS_X, FLAG_SEGMENTS_Y);
    const position = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const y = position.getY(i);
      // 0 at the pole-side edge, 1 at the free tip: taper the tip to a
      // point so the rectangle reads as a triangular pennant.
      const attachFrac = (x + FLAG_WIDTH / 2) / FLAG_WIDTH;
      position.setY(i, y * (1 - attachFrac));
    }
    position.needsUpdate = true;
    geo.computeVertexNormals();
    const base = Float32Array.from(position.array as Float32Array);
    return { geometry: geo, basePositions: base };
  }, []);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const position = mesh.geometry.attributes.position as THREE.BufferAttribute;
    const array = position.array as Float32Array;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < position.count; i++) {
      const bx = basePositions[i * 3];
      const by = basePositions[i * 3 + 1];
      const bz = basePositions[i * 3 + 2];
      const attachFrac = (bx + FLAG_WIDTH / 2) / FLAG_WIDTH;
      array[i * 3] = bx;
      array[i * 3 + 1] = by;
      // Amplitude grows toward the free tip and stays ~0 at the pole edge,
      // matching how a real flag is anchored on one side only.
      array[i * 3 + 2] = bz + Math.sin(t * 5.5 + attachFrac * 7) * 0.05 * attachFrac;
    }
    position.needsUpdate = true;
  });

  const attachX = POLE_TOP_RADIUS + FLAG_WIDTH / 2;
  const attachY = poleHeight - FLAG_HEIGHT * 0.5 - 0.05;

  return (
    <mesh ref={meshRef} geometry={geometry} position={[attachX, attachY, 0]} castShadow>
      <meshStandardMaterial color="#e2381f" roughness={0.7} metalness={0.05} side={THREE.DoubleSide} />
    </mesh>
  );
}

interface FlagPoleProps {
  poleHeight: number;
}

/** The slim vertical flagstick plus its waving pennant near the top. */
function FlagPole({ poleHeight }: FlagPoleProps): JSX.Element {
  const poleGeometry = useMemo(() => {
    const geo = new THREE.CylinderGeometry(POLE_TOP_RADIUS, POLE_BOTTOM_RADIUS, poleHeight, 8);
    geo.translate(0, poleHeight / 2, 0);
    return geo;
  }, [poleHeight]);

  return (
    <group>
      <mesh geometry={poleGeometry} castShadow receiveShadow>
        <meshStandardMaterial color="#e7e2d4" roughness={0.4} metalness={0.35} />
      </mesh>
      <Pennant poleHeight={poleHeight} />
    </group>
  );
}

export function FlagAndCup({
  position,
  heightAt,
  cupRadius,
}: {
  position: Vec2;
  heightAt: HeightSampler;
  cupRadius: number;
}): JSX.Element {
  const [x, z] = position;
  const y = heightAt(x, z);
  // Small deterministic variation (seeded from the pin's own position, 2.0-2.2m)
  // so the stick height isn't identical to the millimetre on every hole.
  const poleHeight = 2.0 + hash(x * 3.1 + z * 7.7, 5) * 0.2;

  return (
    <group position={[x, y, z]}>
      <Cup cupRadius={cupRadius} />
      <FlagPole poleHeight={poleHeight} />
    </group>
  );
}
