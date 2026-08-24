"use client";

import { useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { RapierRigidBody } from "@react-three/rapier";
import { useGameStore } from "../lib/store";
import type { HeightSampler } from "../lib/heightmap";

interface AimIndicatorProps {
  ballRef: RefObject<RapierRigidBody>;
  heightAt: HeightSampler;
}

const LOW_POWER_COLOR = new THREE.Color("#8be07a");
const HIGH_POWER_COLOR = new THREE.Color("#ff5a4d");

/** A ground arrow that appears while charging a shot: length/color track power, rotation tracks aim. */
export function AimIndicator({ ballRef, heightAt }: AimIndicatorProps) {
  const group = useRef<THREE.Group>(null);
  const shaftScale = useRef(0.4);
  const shaftMat = useRef<THREE.MeshBasicMaterial>(null);
  const headMat = useRef<THREE.MeshBasicMaterial>(null);
  const color = useRef(new THREE.Color());

  useFrame((_, delta) => {
    const g = group.current;
    const body = ballRef.current;
    if (!g || !body) return;

    const { aimYaw, power, isPulling, canShoot } = useGameStore.getState();
    const visible = isPulling && canShoot;
    g.visible = visible;
    if (!visible) return;

    const t = body.translation();
    const y = heightAt(t.x, t.z);
    g.position.set(t.x, y + 0.03, t.z);
    g.rotation.y = aimYaw;

    const targetScale = 0.5 + power * 2.6;
    const k = 1 - Math.pow(0.0008, delta);
    shaftScale.current = THREE.MathUtils.lerp(shaftScale.current, targetScale, k);
    g.scale.set(1, 1, shaftScale.current);

    color.current.copy(LOW_POWER_COLOR).lerp(HIGH_POWER_COLOR, power);
    shaftMat.current?.color.copy(color.current);
    headMat.current?.color.copy(color.current);
  });

  return (
    <group ref={group} visible={false}>
      <mesh position={[0, 0, 0.5]}>
        <boxGeometry args={[0.045, 0.018, 1]} />
        <meshBasicMaterial ref={shaftMat} transparent opacity={0.88} />
      </mesh>
      <mesh position={[0, 0, 1.08]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.11, 0.26, 4]} />
        <meshBasicMaterial ref={headMat} transparent opacity={0.92} />
      </mesh>
    </group>
  );
}
