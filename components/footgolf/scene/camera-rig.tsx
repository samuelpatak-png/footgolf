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
// While charging a shot, ease the camera further back/up for a clearer read
// of the hole ahead — the same reason mobile golf games pull the camera out
// during aim instead of keeping the tight in-play follow distance.
const AIM_FOLLOW_DISTANCE = 6.6;
const AIM_FOLLOW_HEIGHT = 3.1;
const LOOK_HEIGHT = 0.4;
const MENU_ORBIT_SPEED = 0.09;

const SHAKE_DURATION = 0.28;
const SHAKE_MAX_OFFSET = 0.16;

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
  const followDistance = useRef(FOLLOW_DISTANCE);
  const followHeight = useRef(FOLLOW_HEIGHT);
  const lastShakeSeed = useRef(-1);
  const shakeStart = useRef(-Infinity);
  const shakeMagnitude = useRef(0);

  useFrame((state, delta) => {
    const body = ballRef.current;
    if (!body) return;
    const t = body.translation();

    if (!ballPos.current) {
      ballPos.current = new THREE.Vector3(t.x, t.y, t.z);
    } else {
      ballPos.current.lerp(new THREE.Vector3(t.x, t.y, t.z), 0.28);
    }

    const { phase, aimYaw, isPulling, isBallMoving, shakeSeed, shakeStrength } = useGameStore.getState();

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

    const targetDistance = isPulling ? AIM_FOLLOW_DISTANCE : FOLLOW_DISTANCE;
    const targetHeight = isPulling ? AIM_FOLLOW_HEIGHT : FOLLOW_HEIGHT;
    followDistance.current = THREE.MathUtils.lerp(followDistance.current, targetDistance, 0.06);
    followHeight.current = THREE.MathUtils.lerp(followHeight.current, targetHeight, 0.06);

    const camX = ballPos.current.x - dirX * followDistance.current;
    const camZ = ballPos.current.z - dirZ * followDistance.current;
    const groundY = heightAt(camX, camZ);
    const camY = Math.max(ballPos.current.y + followHeight.current, groundY + 1.15);

    desiredCamPos.current.set(camX, camY, camZ);
    camera.position.lerp(desiredCamPos.current, 0.1);

    // Brief decaying shake on every kick, punchier for a harder hit.
    if (shakeSeed !== lastShakeSeed.current) {
      lastShakeSeed.current = shakeSeed;
      shakeStart.current = state.clock.elapsedTime;
      shakeMagnitude.current = shakeStrength;
    }
    const shakeElapsed = state.clock.elapsedTime - shakeStart.current;
    if (shakeElapsed >= 0 && shakeElapsed < SHAKE_DURATION) {
      const decay = 1 - shakeElapsed / SHAKE_DURATION;
      const amount = shakeMagnitude.current * decay * SHAKE_MAX_OFFSET;
      camera.position.x += Math.sin(state.clock.elapsedTime * 63.7) * amount;
      camera.position.y += Math.sin(state.clock.elapsedTime * 51.3 + 1.7) * amount * 0.6;
      camera.position.z += Math.sin(state.clock.elapsedTime * 47.1 + 3.1) * amount;
    }

    lookAt.current.set(ballPos.current.x, ballPos.current.y + LOOK_HEIGHT, ballPos.current.z);
    camera.lookAt(lookAt.current);
  });

  return null;
}
