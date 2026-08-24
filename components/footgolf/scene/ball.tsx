"use client";

import { forwardRef, useMemo } from "react";
import { Trail } from "@react-three/drei";
import { BallCollider, RigidBody, type RapierRigidBody } from "@react-three/rapier";
import { createSoccerBallTexture } from "../lib/textures";
import { useGameStore } from "../lib/store";

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
  const isBallMoving = useGameStore((s) => s.isBallMoving);

  const ballMesh = (
    <mesh castShadow receiveShadow>
      <sphereGeometry args={[BALL_RADIUS, 32, 32]} />
      <meshStandardMaterial map={texture} roughness={0.55} metalness={0.04} />
    </mesh>
  );

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
      {isBallMoving ? (
        <Trail width={1.1} length={3.5} decay={2.2} attenuation={(t) => t * t} color="#ffffff" local={false}>
          {ballMesh}
        </Trail>
      ) : (
        ballMesh
      )}
    </RigidBody>
  );
});
