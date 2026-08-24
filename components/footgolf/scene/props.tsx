"use client";

import { useMemo } from "react";
import * as THREE from "three";
import type { ObstacleDef } from "../lib/types";
import type { HeightSampler } from "../lib/heightmap";

/**
 * Procedural course dressing: trees, rocks, bushes, reeds and distance
 * markers. Everything here is built from three.js primitive geometries
 * (jittered, stacked, or scattered in code) — no external models or
 * textures — and geometries that are shared across many instances (trunks,
 * canopy lobes, reed blades, marker bands) are built exactly once via
 * useMemo and reused, since obstacle counts per hole are small enough that
 * plain <mesh> per part is fine without InstancedMesh.
 */

const PINE_TRUNK_HEIGHT = 1.3;
const ROUND_TRUNK_HEIGHT = 1.0;

const TRUNK_COLOR = "#5c4630";
const PINE_FOLIAGE_COLOR = "#3a5240";
const ROUND_CANOPY_COLOR = "#5f8a4c";
const BUSH_COLOR = "#4f7a45";
const ROCK_COLOR = "#8a8378";
const REED_COLOR = "#a3ac52";
const MARKER_RED = "#c1352a";
const MARKER_WHITE = "#eeeee6";

/** Widest/tallest first (bottom of the stack) to narrowest/shortest last (near the apex). */
const PINE_TIER_SPECS: ReadonlyArray<{ radius: number; height: number }> = [
  { radius: 0.95, height: 1.6 },
  { radius: 0.72, height: 1.35 },
  { radius: 0.52, height: 1.1 },
  { radius: 0.34, height: 0.85 },
];

/** Cheap deterministic 0..1 hash, seeded from stable inputs — never Math.random(). */
function hash(seed: number, salt: number): number {
  const s = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453123;
  return s - Math.floor(s);
}

/** Stable per-obstacle seed derived only from data that never changes across re-renders. */
function seedFor(obstacle: ObstacleDef, index: number): number {
  return index * 97.13 + obstacle.position[0] * 3.71 + obstacle.position[1] * 9.13 + (obstacle.variant ?? 0) * 17.29;
}

/**
 * A boulder-like blob: an icosahedron whose vertices are pushed in/out along
 * their own radial direction by a small deterministic amount. Hashing on the
 * (rounded) ORIGINAL vertex coordinates — not the vertex index — means
 * duplicate vertices shared by adjacent faces get identical jitter, so the
 * displaced mesh stays watertight instead of splitting open at the seams.
 */
function createJitteredRockGeometry(
  radius: number,
  detail: number,
  jitterAmount: number,
  seed: number
): THREE.BufferGeometry {
  const geometry = new THREE.IcosahedronGeometry(radius, detail);
  const position = geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const key = Math.round(x * 500) * 12.9898 + Math.round(y * 500) * 78.233 + Math.round(z * 500) * 37.719;
    const n = hash(key, seed);
    const scale = 1 + (n - 0.5) * 2 * jitterAmount;
    position.setXYZ(i, x * scale, y * scale, z * scale);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

interface PropKit {
  /** Unit cylinder spanning local y 0..1, reused (Y-scaled) for every trunk. */
  trunkGeometry: THREE.CylinderGeometry;
  /** Stacked-cone tiers for pine foliage, widest/lowest first. */
  pineTierGeometries: THREE.ConeGeometry[];
  /** Unit-radius icosahedron reused for both round-tree canopy lobes and bush lobes. */
  lobeGeometry: THREE.IcosahedronGeometry;
  /** Unit cylinder spanning local y 0..1, reused (Y-scaled) for every reed blade. */
  reedBladeGeometry: THREE.CylinderGeometry;
  /** Unit cylinder spanning local y 0..1, reused (Y-scaled) for every marker band. */
  markerBandGeometry: THREE.CylinderGeometry;
  trunkMaterial: THREE.MeshStandardMaterial;
  pineFoliageMaterial: THREE.MeshStandardMaterial;
  roundCanopyMaterial: THREE.MeshStandardMaterial;
  bushMaterial: THREE.MeshStandardMaterial;
  rockMaterial: THREE.MeshStandardMaterial;
  reedMaterial: THREE.MeshStandardMaterial;
  markerRedMaterial: THREE.MeshStandardMaterial;
  markerWhiteMaterial: THREE.MeshStandardMaterial;
}

function buildPropKit(): PropKit {
  const trunkGeometry = new THREE.CylinderGeometry(0.075, 0.12, 1, 7);
  trunkGeometry.translate(0, 0.5, 0);

  const pineTierGeometries = PINE_TIER_SPECS.map((spec) => {
    const geo = new THREE.ConeGeometry(spec.radius, spec.height, 7);
    geo.translate(0, spec.height / 2, 0);
    return geo;
  });

  const lobeGeometry = new THREE.IcosahedronGeometry(1, 1);

  const reedBladeGeometry = new THREE.CylinderGeometry(0.006, 0.022, 1, 4);
  reedBladeGeometry.translate(0, 0.5, 0);

  const markerBandGeometry = new THREE.CylinderGeometry(0.035, 0.035, 1, 8);
  markerBandGeometry.translate(0, 0.5, 0);

  return {
    trunkGeometry,
    pineTierGeometries,
    lobeGeometry,
    reedBladeGeometry,
    markerBandGeometry,
    trunkMaterial: new THREE.MeshStandardMaterial({ color: TRUNK_COLOR, roughness: 0.95, metalness: 0 }),
    pineFoliageMaterial: new THREE.MeshStandardMaterial({
      color: PINE_FOLIAGE_COLOR,
      roughness: 0.9,
      metalness: 0,
      flatShading: true,
    }),
    roundCanopyMaterial: new THREE.MeshStandardMaterial({ color: ROUND_CANOPY_COLOR, roughness: 0.85, metalness: 0 }),
    bushMaterial: new THREE.MeshStandardMaterial({
      color: BUSH_COLOR,
      roughness: 0.85,
      metalness: 0,
      flatShading: true,
    }),
    rockMaterial: new THREE.MeshStandardMaterial({
      color: ROCK_COLOR,
      roughness: 0.96,
      metalness: 0.02,
      flatShading: true,
    }),
    reedMaterial: new THREE.MeshStandardMaterial({ color: REED_COLOR, roughness: 0.8, metalness: 0 }),
    markerRedMaterial: new THREE.MeshStandardMaterial({ color: MARKER_RED, roughness: 0.5, metalness: 0.1 }),
    markerWhiteMaterial: new THREE.MeshStandardMaterial({ color: MARKER_WHITE, roughness: 0.5, metalness: 0.05 }),
  };
}

/** Conifer: a tapered trunk plus 2-4 stacked, overlapping cone tiers narrowing upward. */
function PineTree({ seed, kit }: { seed: number; kit: PropKit }): JSX.Element {
  const tierCount = 2 + Math.floor(hash(seed, 1) * 3); // 2..4

  const tierYs = useMemo(() => {
    const ys: number[] = [];
    let y = PINE_TRUNK_HEIGHT - 0.35;
    for (let i = 0; i < tierCount; i++) {
      ys.push(y);
      y += PINE_TIER_SPECS[i].height * 0.5;
    }
    return ys;
  }, [tierCount]);

  return (
    <group>
      <mesh
        geometry={kit.trunkGeometry}
        material={kit.trunkMaterial}
        scale={[1, PINE_TRUNK_HEIGHT, 1]}
        castShadow
        receiveShadow
      />
      {tierYs.map((y, i) => (
        <mesh
          key={i}
          geometry={kit.pineTierGeometries[i]}
          material={kit.pineFoliageMaterial}
          position={[0, y, 0]}
          castShadow
          receiveShadow
        />
      ))}
    </group>
  );
}

/** Broadleaf: a trunk plus 3-4 overlapping rounded canopy lobes with deterministic jitter. */
function RoundTree({ seed, kit }: { seed: number; kit: PropKit }): JSX.Element {
  const lobeCount = 3 + Math.floor(hash(seed, 1) * 2); // 3..4

  const lobes = useMemo(() => {
    const centerY = ROUND_TRUNK_HEIGHT + 0.7;
    const items: Array<{ key: number; x: number; y: number; z: number; scale: number }> = [];
    for (let i = 0; i < lobeCount; i++) {
      if (i === 0) {
        // A solid core lobe so the middle of the canopy never gaps.
        items.push({ key: i, x: 0, y: centerY, z: 0, scale: 0.82 });
        continue;
      }
      const angle = (i / lobeCount) * Math.PI * 2 + hash(seed, 20 + i) * 1.1;
      const radial = 0.28 + hash(seed, 30 + i) * 0.32;
      items.push({
        key: i,
        x: Math.cos(angle) * radial,
        y: centerY + (hash(seed, 40 + i) - 0.5) * 0.45,
        z: Math.sin(angle) * radial,
        scale: 0.55 + hash(seed, 50 + i) * 0.4,
      });
    }
    return items;
  }, [seed, lobeCount]);

  return (
    <group>
      <mesh
        geometry={kit.trunkGeometry}
        material={kit.trunkMaterial}
        scale={[1.15, ROUND_TRUNK_HEIGHT, 1.15]}
        castShadow
        receiveShadow
      />
      {lobes.map((l) => (
        <mesh
          key={l.key}
          geometry={kit.lobeGeometry}
          material={kit.roundCanopyMaterial}
          position={[l.x, l.y, l.z]}
          scale={l.scale}
          castShadow
          receiveShadow
        />
      ))}
    </group>
  );
}

/** A single irregular boulder, jittered from an icosahedron and half-sunk into the ground. */
function Rock({ seed, kit, radius = 0.42 }: { seed: number; kit: PropKit; radius?: number }): JSX.Element {
  const jitterAmount = 0.16 + hash(seed, 70) * 0.14;
  const geometry = useMemo(
    () => createJitteredRockGeometry(radius, 1, jitterAmount, seed),
    [seed, radius, jitterAmount]
  );
  const tiltX = (hash(seed, 60) - 0.5) * 0.5;
  const tiltZ = (hash(seed, 62) - 0.5) * 0.5;
  const spinY = hash(seed, 61) * Math.PI * 2;

  return (
    <mesh
      geometry={geometry}
      material={kit.rockMaterial}
      position={[0, radius * 0.6, 0]}
      rotation={[tiltX, spinY, tiltZ]}
      castShadow
      receiveShadow
    />
  );
}

/** 3-5 smaller boulders grouped with varied position/rotation/scale around the obstacle's origin. */
function RockCluster({ seed, kit }: { seed: number; kit: PropKit }): JSX.Element {
  const rockCount = 3 + Math.floor(hash(seed, 1) * 3); // 3..5

  const rocks = useMemo(() => {
    const items: Array<{ key: number; radius: number; x: number; z: number; rockSeed: number }> = [];
    for (let i = 0; i < rockCount; i++) {
      const angle = (i / rockCount) * Math.PI * 2 + hash(seed, 10 + i) * 1.4;
      const dist = 0.18 + hash(seed, 20 + i) * 0.42;
      items.push({
        key: i,
        radius: 0.16 + hash(seed, 30 + i) * 0.22,
        x: Math.cos(angle) * dist,
        z: Math.sin(angle) * dist,
        rockSeed: seed + (i + 1) * 733.7,
      });
    }
    return items;
  }, [seed, rockCount]);

  return (
    <group>
      {rocks.map((r) => (
        <group key={r.key} position={[r.x, 0, r.z]}>
          <Rock seed={r.rockSeed} kit={kit} radius={r.radius} />
        </group>
      ))}
    </group>
  );
}

/** 2-4 small overlapping spheres, flat-shaded and low to the ground — denser than a tree canopy. */
function Bush({ seed, kit }: { seed: number; kit: PropKit }): JSX.Element {
  const lobeCount = 2 + Math.floor(hash(seed, 1) * 3); // 2..4

  const lobes = useMemo(() => {
    const items: Array<{ key: number; x: number; y: number; z: number; scale: number }> = [];
    for (let i = 0; i < lobeCount; i++) {
      const angle = (i / lobeCount) * Math.PI * 2 + hash(seed, 20 + i) * 1.5;
      const radial = hash(seed, 30 + i) * 0.18;
      items.push({
        key: i,
        x: Math.cos(angle) * radial,
        y: 0.16 + hash(seed, 40 + i) * 0.08,
        z: Math.sin(angle) * radial,
        scale: 0.22 + hash(seed, 50 + i) * 0.14,
      });
    }
    return items;
  }, [seed, lobeCount]);

  return (
    <group>
      {lobes.map((l) => (
        <mesh
          key={l.key}
          geometry={kit.lobeGeometry}
          material={kit.bushMaterial}
          position={[l.x, l.y, l.z]}
          scale={l.scale}
          castShadow
          receiveShadow
        />
      ))}
    </group>
  );
}

/** 6-10 thin vertical blades with randomized height/lean/rotation, meant for a water's edge. */
function Reeds({ seed, kit }: { seed: number; kit: PropKit }): JSX.Element {
  const bladeCount = 6 + Math.floor(hash(seed, 1) * 5); // 6..10

  const blades = useMemo(() => {
    const items: Array<{ key: number; x: number; z: number; height: number; leanX: number; leanZ: number; rotY: number }> = [];
    for (let i = 0; i < bladeCount; i++) {
      const angle = hash(seed, 10 + i) * Math.PI * 2;
      const radial = hash(seed, 20 + i) * 0.55;
      items.push({
        key: i,
        x: Math.cos(angle) * radial,
        z: Math.sin(angle) * radial,
        height: 0.85 + hash(seed, 30 + i) * 0.65,
        leanX: (hash(seed, 40 + i) - 0.5) * 0.35,
        leanZ: (hash(seed, 50 + i) - 0.5) * 0.35,
        rotY: hash(seed, 60 + i) * Math.PI * 2,
      });
    }
    return items;
  }, [seed, bladeCount]);

  return (
    <group>
      {blades.map((b) => (
        <mesh
          key={b.key}
          geometry={kit.reedBladeGeometry}
          material={kit.reedMaterial}
          position={[b.x, 0, b.z]}
          rotation={[b.leanX, b.rotY, b.leanZ]}
          scale={[1, b.height, 1]}
          castShadow
          receiveShadow
        />
      ))}
    </group>
  );
}

/** A short distance-marker post: alternating red/white bands topped with a red cap. */
function PostMarker({ kit }: { kit: PropKit }): JSX.Element {
  const bandHeight = 0.15;

  return (
    <group>
      <mesh
        geometry={kit.markerBandGeometry}
        material={kit.markerRedMaterial}
        position={[0, 0, 0]}
        scale={[1, bandHeight, 1]}
        castShadow
        receiveShadow
      />
      <mesh
        geometry={kit.markerBandGeometry}
        material={kit.markerWhiteMaterial}
        position={[0, bandHeight, 0]}
        scale={[1, bandHeight, 1]}
        castShadow
        receiveShadow
      />
      <mesh
        geometry={kit.markerBandGeometry}
        material={kit.markerRedMaterial}
        position={[0, bandHeight * 2, 0]}
        scale={[1, bandHeight, 1]}
        castShadow
        receiveShadow
      />
      <mesh position={[0, bandHeight * 3, 0]} castShadow receiveShadow>
        <sphereGeometry args={[0.045, 8, 6]} />
        <meshStandardMaterial color={MARKER_RED} roughness={0.4} metalness={0.1} />
      </mesh>
    </group>
  );
}

function renderObstacle(obstacle: ObstacleDef, seed: number, kit: PropKit): JSX.Element {
  switch (obstacle.type) {
    case "pineTree":
      return <PineTree seed={seed} kit={kit} />;
    case "roundTree":
      return <RoundTree seed={seed} kit={kit} />;
    case "rock":
      return <Rock seed={seed} kit={kit} />;
    case "rockCluster":
      return <RockCluster seed={seed} kit={kit} />;
    case "bush":
      return <Bush seed={seed} kit={kit} />;
    case "reeds":
      return <Reeds seed={seed} kit={kit} />;
    case "postMarker":
      return <PostMarker kit={kit} />;
    default: {
      const exhaustive: never = obstacle.type;
      throw new Error(`Neznámy typ prekážky: ${String(exhaustive)}`);
    }
  }
}

interface PropInstanceProps {
  obstacle: ObstacleDef;
  index: number;
  heightAt: HeightSampler;
  kit: PropKit;
}

function PropInstance({ obstacle, index, heightAt, kit }: PropInstanceProps): JSX.Element {
  const [x, z] = obstacle.position;
  const y = heightAt(x, z);
  const seed = seedFor(obstacle, index);
  const scale = obstacle.scale ?? 1;
  const rotationY = obstacle.rotation ?? 0;

  return (
    <group position={[x, y, z]} rotation={[0, rotationY, 0]} scale={scale}>
      {renderObstacle(obstacle, seed, kit)}
    </group>
  );
}

export function PropsField({
  obstacles,
  heightAt,
}: {
  obstacles: ObstacleDef[];
  heightAt: HeightSampler;
}): JSX.Element {
  const kit = useMemo(() => buildPropKit(), []);

  return (
    <group>
      {obstacles.map((obstacle, index) => (
        <PropInstance key={index} obstacle={obstacle} index={index} heightAt={heightAt} kit={kit} />
      ))}
    </group>
  );
}
