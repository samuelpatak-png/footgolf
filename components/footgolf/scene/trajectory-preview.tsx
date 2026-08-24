"use client";

import { useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { RapierRigidBody } from "@react-three/rapier";
import { useGameStore, type LoftMode } from "../lib/store";
import type { HeightSampler } from "../lib/heightmap";

interface TrajectoryPreviewProps {
  ballRef: RefObject<RapierRigidBody>;
  heightAt: HeightSampler;
  minSpeed: number;
  maxSpeed: number;
  loftAngles: Record<LoftMode, number>;
}

const DOT_COUNT = 16;
const TIME_STEP = 0.09;
const GRAVITY = 9.81;

/**
 * Dotted arc of "ghost" markers shown while charging a shot, previewing
 * roughly where the ball would land. Mirrors the exact impulse math from
 * Course.handleKick (same speed lerp, loft angle, yaw) but simulates it as an
 * idealized unobstructed projectile — no drag, wind, or bounce — which is a
 * close enough read for aiming purposes without duplicating the physics
 * engine. The arc is cut the first time it dips to the terrain height under
 * it, so it reads as "where it lands" rather than an infinite parabola.
 */
export function TrajectoryPreview({ ballRef, heightAt, minSpeed, maxSpeed, loftAngles }: TrajectoryPreviewProps) {
  const group = useRef<THREE.Group>(null);
  const dotRefs = useRef<(THREE.Mesh | null)[]>([]);

  useFrame(() => {
    const g = group.current;
    const body = ballRef.current;
    if (!g || !body) return;

    const { aimYaw, power, isPulling, canShoot, loft } = useGameStore.getState();
    const visible = isPulling && canShoot && power > 0.02;
    g.visible = visible;
    if (!visible) return;

    const t0 = body.translation();
    const loftAngle = loftAngles[loft] ?? loftAngles.normal;
    const speed = THREE.MathUtils.lerp(minSpeed, maxSpeed, power);
    const horizontal = Math.cos(loftAngle);
    const vx = Math.sin(aimYaw) * horizontal * speed;
    const vz = Math.cos(aimYaw) * horizontal * speed;
    const vy = Math.sin(loftAngle) * speed;

    let landed = false;
    for (let i = 0; i < DOT_COUNT; i++) {
      const dot = dotRefs.current[i];
      if (!dot) continue;
      if (landed) {
        dot.visible = false;
        continue;
      }

      const t = (i + 1) * TIME_STEP;
      const x = t0.x + vx * t;
      const z = t0.z + vz * t;
      const y = t0.y + vy * t - 0.5 * GRAVITY * t * t;
      const groundY = heightAt(x, z);

      if (y <= groundY + 0.05) {
        landed = true;
        dot.visible = false;
        continue;
      }

      dot.visible = true;
      dot.position.set(x, y, z);
      dot.scale.setScalar(0.4 + (i / DOT_COUNT) * 0.6);
    }
  });

  return (
    <group ref={group} visible={false}>
      {Array.from({ length: DOT_COUNT }).map((_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            dotRefs.current[i] = el;
          }}
        >
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.7} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}
