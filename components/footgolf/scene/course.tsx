"use client";

import { useCallback, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { RapierRigidBody } from "@react-three/rapier";

import { Terrain, buildHeightSampler } from "./terrain";
import { Ball, BALL_RADIUS } from "./ball";
import { CameraRig } from "./camera-rig";
import { AimIndicator } from "./aim-indicator";
import { AimController } from "../controls/aim-controller";
import { Water } from "./water";
import { PropsField } from "./props";
import { FlagAndCup } from "./flag";
import { SkyEnvironment } from "./sky-environment";
import { isInWaterHazard, surfaceAt, SURFACE_DAMPING } from "../lib/surface-map";
import { useGameStore, type LoftMode } from "../lib/store";
import { playHoleIn, playKick, playSplash } from "../lib/audio";
import type { HoleDefinition } from "../lib/types";

const SETTLE_SPEED = 0.22;
const SETTLE_ANGULAR = 1.0;
const SETTLE_FRAMES_REQUIRED = 20;
// Safety net: if the ball has been grounded and reasonably calm for this long
// without ever quite crossing the strict settle thresholds above (e.g. a very
// gentle residual creep on a slope), just let the next shot happen anyway
// rather than risk soft-locking the game.
const FORCE_SETTLE_FRAMES = 240;
const FORCE_SETTLE_SPEED = 1.2;
const MIN_KICK_SPEED = 3.2;
const MAX_KICK_SPEED = 15.5;
const LOFT_ANGLES: Record<LoftMode, number> = { low: 0.14, normal: 0.32, high: 0.58 };

interface CourseProps {
  hole: HoleDefinition;
}

export function Course({ hole }: CourseProps) {
  const heightAt = useRef(buildHeightSampler(hole)).current;
  const ballRef = useRef<RapierRigidBody>(null);
  const settledFrames = useRef(0);
  const groundedFrames = useRef(0);
  const holedRef = useRef(false);

  const teeY = heightAt(hole.tee[0], hole.tee[1]) + BALL_RADIUS + 0.05;
  const lastRestPosition = useRef(new THREE.Vector3(hole.tee[0], teeY, hole.tee[1]));
  const startPosition = useRef<[number, number, number]>([hole.tee[0], teeY, hole.tee[1]]).current;

  const phase = useGameStore((s) => s.phase);
  const canShoot = useGameStore((s) => s.canShoot);

  const resetBallTo = useCallback((pos: THREE.Vector3) => {
    const body = ballRef.current;
    if (!body) return;
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    body.setTranslation({ x: pos.x, y: pos.y, z: pos.z }, true);
    settledFrames.current = 0;
    groundedFrames.current = 0;
    useGameStore.getState().setCanShoot(false);
    useGameStore.getState().setBallMoving(false);
  }, []);

  const handleKick = useCallback((yaw: number, power: number) => {
    const body = ballRef.current;
    const { canShoot: currentlyCanShoot, loft } = useGameStore.getState();
    if (!body || !currentlyCanShoot || holedRef.current) return;

    const t = body.translation();
    lastRestPosition.current.set(t.x, t.y, t.z);

    const loftAngle = LOFT_ANGLES[loft] ?? LOFT_ANGLES.normal;
    const speed = THREE.MathUtils.lerp(MIN_KICK_SPEED, MAX_KICK_SPEED, power);
    const horizontal = Math.cos(loftAngle);
    const vertical = Math.sin(loftAngle);
    const dirX = Math.sin(yaw) * horizontal;
    const dirZ = Math.cos(yaw) * horizontal;

    const mass = body.mass();
    body.applyImpulse({ x: dirX * speed * mass, y: vertical * speed * mass, z: dirZ * speed * mass }, true);
    body.applyTorqueImpulse(
      { x: -dirZ * speed * mass * 0.012, y: 0, z: dirX * speed * mass * 0.012 },
      true
    );

    useGameStore.getState().addStroke();
    useGameStore.getState().setCanShoot(false);
    useGameStore.getState().setBallMoving(true);
    settledFrames.current = 0;
    groundedFrames.current = 0;
    playKick(power);
  }, []);

  useFrame(() => {
    const body = ballRef.current;
    if (!body || holedRef.current) return;

    const t = body.translation();
    const v = body.linvel();
    const av = body.angvel();
    const speed2 = v.x * v.x + v.y * v.y + v.z * v.z;
    const angSpeed2 = av.x * av.x + av.y * av.y + av.z * av.z;

    const groundY = heightAt(t.x, t.z);
    const grounded = t.y - groundY < BALL_RADIUS + 0.3;

    if (grounded) {
      const surface = surfaceAt(hole.surfaceZones, t.x, t.z);
      const damping = SURFACE_DAMPING[surface];
      body.setLinearDamping(damping);
      body.setAngularDamping(damping * 0.5);
    } else {
      body.setLinearDamping(0.05);
      body.setAngularDamping(0.1);
    }

    const hazard = isInWaterHazard(hole.waterHazards, t.x, t.z);
    if (hazard && t.y < hazard.level + 0.06) {
      playSplash();
      useGameStore.getState().addStroke();
      useGameStore.getState().showToast("Do vody! +1 trestný úder");
      resetBallTo(lastRestPosition.current);
      return;
    }

    const { width, depth } = hole.bounds;
    const margin = 2.5;
    const outOfBounds =
      Math.abs(t.x) > width / 2 + margin || Math.abs(t.z) > depth / 2 + margin || t.y < hole.baseHeight - 12;
    if (outOfBounds) {
      useGameStore.getState().addStroke();
      useGameStore.getState().showToast("Mimo hracej plochy! +1 trestný úder");
      resetBallTo(lastRestPosition.current);
      return;
    }

    const dx = t.x - hole.pin[0];
    const dz = t.z - hole.pin[1];
    const distToPin = Math.hypot(dx, dz);
    if (grounded && distToPin < hole.cupRadius && speed2 < 2.2 * 2.2) {
      holedRef.current = true;
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      body.setTranslation({ x: hole.pin[0], y: groundY - 0.18, z: hole.pin[1] }, true);
      playHoleIn();
      useGameStore.getState().setBallMoving(false);
      useGameStore.getState().setCanShoot(false);
      window.setTimeout(() => {
        useGameStore.getState().completeHole(hole.id, hole.name, hole.par);
      }, 700);
      return;
    }

    const store = useGameStore.getState();
    groundedFrames.current = grounded ? groundedFrames.current + 1 : 0;

    const settledByThreshold =
      grounded && speed2 < SETTLE_SPEED * SETTLE_SPEED && angSpeed2 < SETTLE_ANGULAR * SETTLE_ANGULAR;
    const settledByTimeout =
      grounded && groundedFrames.current >= FORCE_SETTLE_FRAMES && speed2 < FORCE_SETTLE_SPEED * FORCE_SETTLE_SPEED;

    if (settledByThreshold || settledByTimeout) {
      settledFrames.current += 1;
      if (settledByTimeout || settledFrames.current >= SETTLE_FRAMES_REQUIRED) {
        if (!store.canShoot) store.setCanShoot(true);
        if (store.isBallMoving) store.setBallMoving(false);
        lastRestPosition.current.set(t.x, t.y, t.z);
      }
    } else {
      settledFrames.current = 0;
      if (!store.isBallMoving && speed2 > (SETTLE_SPEED * 2) ** 2) store.setBallMoving(true);
    }
  });

  return (
    <>
      <SkyEnvironment bounds={hole.bounds} />
      <Terrain hole={hole} heightAt={heightAt} />
      {hole.waterHazards.map((hazard, i) => (
        <Water key={i} shape={hazard.shape} level={hazard.level} />
      ))}
      <PropsField obstacles={hole.obstacles} heightAt={heightAt} />
      <FlagAndCup position={hole.pin} heightAt={heightAt} cupRadius={hole.cupRadius} />
      <Ball ref={ballRef} startPosition={startPosition} />
      <CameraRig ballRef={ballRef} heightAt={heightAt} initialYaw={hole.startYaw} />
      <AimIndicator ballRef={ballRef} heightAt={heightAt} />
      <AimController enabled={phase === "playing" && canShoot} baseYaw={hole.startYaw} onKick={handleKick} />
    </>
  );
}
