"use client";

import { forwardRef, useMemo } from "react";
import { BallCollider, RigidBody, type RapierRigidBody } from "@react-three/rapier";
import { createSoccerBallTexture } from "../lib/textures";

export const BALL_RADIUS = 0.11;

interface BallProps {
  startPosition: [number, number, number];
}

/**
 * The ball is a "dumb" physics + visual component: it forwards its Rapier
 * rigid body ref so the game logic (kick impulses, water/hole detection,
 * per-surface damping) can be owned centrally in one place that already
 * knows the current hole's data.
 */
export const Ball = forwardRef<RapierRigidBody, BallProps>(function Ball({ startPosition }, ref) {
  const texture = useMemo(() => createSoccerBallTexture(), []);

  return (
    <RigidBody
      ref={ref}
      colliders={false}
      position={startPosition}
      canSleep={false}
      ccd
      linearDamping={0.25}
      angularDamping={0.35}
    >
      <BallCollider args={[BALL_RADIUS]} friction={0.6} restitution={0.4} mass={0.43} />
      <mesh castShadow receiveShadow>
        <sphereGeometry args={[BALL_RADIUS, 32, 32]} />
        <meshStandardMaterial map={texture} roughness={0.55} metalness={0.04} />
      </mesh>
    </RigidBody>
  );
});
