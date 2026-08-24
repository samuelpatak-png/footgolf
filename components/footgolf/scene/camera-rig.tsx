"use client";

import { useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { RapierRigidBody } from "@react-three/rapier";
import { useGameStore } from "../lib/store";
import type { HeightSampler } from "../lib/heightmap";

interface CameraRigProps {
  ballRef: RefObject<RapierRigidBody>;
  heightAt: HeightSampler;
  initialYaw: number;
}

const FOLLOW_DISTANCE = 4.6;
const FOLLOW_HEIGHT = 1.85;
const LOOK_HEIGHT = 0.4;
const MENU_ORBIT_SPEED = 0.09;

/**
 * Manually drives the camera every frame instead of using OrbitControls: a
 * third-person "chase" rig that follows the ball, faces the live drag-aim
 * direction while charging a shot, and stays clamped above the terrain so
 * it never dips underground on hilly holes.
 */
export function CameraRig({ ballRef, heightAt, initialYaw }: CameraRigProps) {
  const { camera } = useThree();
  const smoothedYaw = useRef(initialYaw);
  const menuOrbitYaw = useRef(initialYaw);
  const ballPos = useRef<THREE.Vector3 | null>(null);
  const desiredCamPos = useRef(new THREE.Vector3());
  const lookAt = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    const body = ballRef.current;
    if (!body) return;
    const t = body.translation();

    if (!ballPos.current) {
      ballPos.current = new THREE.Vector3(t.x, t.y, t.z);
    } else {
      ballPos.current.lerp(new THREE.Vector3(t.x, t.y, t.z), 0.28);
    }

    const { phase, aimYaw, isPulling, isBallMoving } = useGameStore.getState();

    let desiredYaw: number;
    if (phase === "menu") {
      menuOrbitYaw.current += delta * MENU_ORBIT_SPEED;
      desiredYaw = menuOrbitYaw.current;
    } else if (isPulling || !isBallMoving) {
      desiredYaw = aimYaw;
    } else {
      desiredYaw = smoothedYaw.current;
    }

    const yawLerp = isPulling ? 0.4 : phase === "menu" ? 1 : 0.14;
    smoothedYaw.current = THREE.MathUtils.lerp(smoothedYaw.current, desiredYaw, yawLerp);

    const dirX = Math.sin(smoothedYaw.current);
    const dirZ = Math.cos(smoothedYaw.current);

    const camX = ballPos.current.x - dirX * FOLLOW_DISTANCE;
    const camZ = ballPos.current.z - dirZ * FOLLOW_DISTANCE;
    const groundY = heightAt(camX, camZ);
    const camY = Math.max(ballPos.current.y + FOLLOW_HEIGHT, groundY + 1.15);

    desiredCamPos.current.set(camX, camY, camZ);
    camera.position.lerp(desiredCamPos.current, 0.1);

    lookAt.current.set(ballPos.current.x, ballPos.current.y + LOOK_HEIGHT, ballPos.current.z);
    camera.lookAt(lookAt.current);
  });

  return null;
}
