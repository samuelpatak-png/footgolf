"use client";

import { forwardRef, useMemo } from "react";
import * as THREE from "three";
import { createShadowBlobTexture } from "../lib/textures";

let sharedTexture: THREE.Texture | null = null;
export function getSharedShadowTexture(): THREE.Texture {
  if (!sharedTexture) sharedTexture = createShadowBlobTexture();
  return sharedTexture;
}

interface ShadowBlobProps {
  radius?: number;
  opacity?: number;
  /** Local Y offset above the ground it's drawn on, to avoid z-fighting. */
  y?: number;
}

/**
 * Flat, unlit, alpha-blended dark disc laid on the ground. A cheap grounding
 * cue for static props (trees/rocks/bushes) and — via the forwarded ref —
 * the ball's own shadow, which Course repositions/fades every frame based
 * on how high it is off the ground.
 */
export const ShadowBlob = forwardRef<THREE.Mesh, ShadowBlobProps>(function ShadowBlob(
  { radius = 0.5, opacity = 0.5, y = 0.006 },
  ref
) {
  const texture = useMemo(() => getSharedShadowTexture(), []);

  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]} renderOrder={1}>
      <circleGeometry args={[radius, 20]} />
      <meshBasicMaterial map={texture} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
});
