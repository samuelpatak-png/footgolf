"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { RigidBody, TrimeshCollider } from "@react-three/rapier";
import { createHeightSampler, type HeightSampler } from "../lib/heightmap";
import { groundBlendWeightsAt } from "../lib/surface-map";
import { createFairwayTexture, createGreenTexture, createRoughTexture, createSandTexture } from "../lib/textures";
import { createTerrainMaterial } from "./terrain-material";
import type { HoleDefinition } from "../lib/types";

const CELL_SIZE = 0.55;
const MIN_SEGMENTS = 40;
const MAX_SEGMENTS = 180;

export function buildHeightSampler(hole: HoleDefinition): HeightSampler {
  return createHeightSampler(hole.terrain, hole.baseHeight);
}

interface TerrainProps {
  hole: HoleDefinition;
  heightAt: HeightSampler;
}

/**
 * Renders the course ground and builds a static trimesh collider from the
 * exact same triangles as the visual mesh, so the ball can never visually
 * float above or clip through the grass.
 *
 * (An earlier version used a Rapier HeightfieldCollider sampled from the
 * same height function. That produced a geometrically correct collider
 * — verified independently against @dimforge/rapier3d-compat directly —
 * but never actually registered a single contact against the ball once
 * wired up through @react-three/rapier's <HeightfieldCollider>, while an
 * identically-configured CuboidCollider in the same scene collided fine.
 * That points to a heightfield-specific integration issue in this
 * dependency version. A trimesh collider built from the identical geometry
 * sidesteps it entirely and is the standard, well-supported choice for
 * static terrain anyway.)
 */
export function Terrain({ hole, heightAt }: TerrainProps) {
  const { width, depth } = hole.bounds;

  const built = useMemo(() => {
    const segX = THREE.MathUtils.clamp(Math.round(width / CELL_SIZE), MIN_SEGMENTS, MAX_SEGMENTS);
    const segZ = THREE.MathUtils.clamp(Math.round(depth / CELL_SIZE), MIN_SEGMENTS, MAX_SEGMENTS);
    const nx = segX + 1;
    const nz = segZ + 1;

    const positions = new Float32Array(nx * nz * 3);
    const uvs = new Float32Array(nx * nz * 2);
    const colors = new Float32Array(nx * nz * 3);

    const uvRepeat = Math.max(width, depth) / 6;

    for (let c = 0; c < nz; c++) {
      const z = -depth / 2 + (c / segZ) * depth;
      for (let r = 0; r < nx; r++) {
        const x = -width / 2 + (r / segX) * width;
        const y = heightAt(x, z);
        const idx = c * nx + r;

        positions[idx * 3] = x;
        positions[idx * 3 + 1] = y;
        positions[idx * 3 + 2] = z;

        uvs[idx * 2] = (r / segX) * uvRepeat;
        uvs[idx * 2 + 1] = (c / segZ) * uvRepeat;

        const w = groundBlendWeightsAt(hole.surfaceZones, x, z);
        colors[idx * 3] = w.rough;
        colors[idx * 3 + 1] = w.sand;
        colors[idx * 3 + 2] = w.green;
      }
    }

    const indices = new Uint32Array(segX * segZ * 6);
    let ii = 0;
    for (let c = 0; c < segZ; c++) {
      for (let r = 0; r < segX; r++) {
        const a = c * nx + r;
        const b = a + 1;
        const cc = a + nx;
        const d = cc + 1;
        indices[ii++] = a;
        indices[ii++] = cc;
        indices[ii++] = b;
        indices[ii++] = b;
        indices[ii++] = cc;
        indices[ii++] = d;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.computeVertexNormals();

    // Built once and reused as-is: @react-three/rapier treats a collider's
    // `args` as immutable and destroys/recreates the physics collider
    // whenever this array's reference changes, so a fresh inline literal on
    // every render would tear down and rebuild the ground collider on every
    // re-render of this component.
    //
    // The 3rd element is Rapier's TriMeshFlags.ORIENTED (value 8): it makes
    // Parry compute smooth pseudo-normals for shared vertices/edges instead
    // of a raw per-triangle normal, which is what stops a fast-rolling ball
    // from picking up a spurious sideways kick every time it crosses from
    // one triangle of the ground mesh onto the next. @react-three/rapier's
    // TrimeshArgs type only declares [vertices, indices], but the underlying
    // Rapier binding accepts this 3rd flags argument too.
    const trimeshArgs = [positions, indices, 8] as unknown as [Float32Array, Uint32Array];

    return { geometry, trimeshArgs };
  }, [hole, heightAt, width, depth]);

  const textures = useMemo(
    () => ({
      fairway: createFairwayTexture(),
      rough: createRoughTexture(),
      sand: createSandTexture(),
      green: createGreenTexture(),
    }),
    []
  );

  const material = useMemo(() => createTerrainMaterial(textures), [textures]);

  return (
    <RigidBody type="fixed" colliders={false}>
      <TrimeshCollider args={built.trimeshArgs} friction={0.7} restitution={0.15} />
      <mesh geometry={built.geometry} material={material} receiveShadow castShadow />
    </RigidBody>
  );
}
