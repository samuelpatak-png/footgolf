"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export type BurstType = "dust" | "splash";

export interface BurstSpec {
  id: number;
  type: BurstType;
  position: readonly [number, number, number];
}

const DUST_COLOR = new THREE.Color("#c9b892");
const SPLASH_COLOR = new THREE.Color("#eaf7f9");
const PARTICLE_COUNT = 12;
const LIFETIME = 0.55;
const GRAVITY = 5;

interface ParticleMotion {
  vx: number;
  vy: number;
  vz: number;
  spin: number;
  seed: number;
}

interface ParticleBurstProps {
  type: BurstType;
  position: readonly [number, number, number];
  onDone: () => void;
}

/** A short-lived burst of billboard-ish planes flung outward and up, fading over ~0.5s. */
function ParticleBurst({ type, position, onDone }: ParticleBurstProps) {
  const groupRef = useRef<THREE.Group>(null);
  const age = useRef(0);
  const doneRef = useRef(false);

  const geometry = useMemo(() => new THREE.PlaneGeometry(0.055, 0.055), []);
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: type === "splash" ? SPLASH_COLOR : DUST_COLOR,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      }),
    [type]
  );

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material]
  );

  const particles = useMemo<ParticleMotion[]>(() => {
    const spread = type === "splash" ? 2.6 : 1.3;
    const upBias = type === "splash" ? 3.4 : 1.5;
    const items: ParticleMotion[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle = (i / PARTICLE_COUNT) * Math.PI * 2 + Math.random() * 0.6;
      const radial = spread * (0.45 + Math.random() * 0.55);
      items.push({
        vx: Math.cos(angle) * radial,
        vy: upBias * (0.55 + Math.random() * 0.6),
        vz: Math.sin(angle) * radial,
        spin: (Math.random() - 0.5) * 9,
        seed: Math.random() * Math.PI * 2,
      });
    }
    return items;
  }, [type]);

  useFrame((_, delta) => {
    age.current += delta;
    const t = age.current / LIFETIME;
    if (t >= 1) {
      if (!doneRef.current) {
        doneRef.current = true;
        onDone();
      }
      return;
    }
    const group = groupRef.current;
    if (!group) return;
    material.opacity = (1 - t) * 0.85;
    const shrink = type === "splash" ? 1 + t * 0.5 : 1 - t * 0.35;
    for (let i = 0; i < group.children.length; i++) {
      const p = particles[i];
      const mesh = group.children[i] as THREE.Mesh;
      mesh.position.set(p.vx * t, p.vy * t - GRAVITY * t * t, p.vz * t);
      mesh.rotation.z = p.seed + p.spin * age.current;
      mesh.scale.setScalar(shrink);
    }
  });

  return (
    <group ref={groupRef} position={position as [number, number, number]}>
      {particles.map((_, i) => (
        <mesh key={i} geometry={geometry} material={material} />
      ))}
    </group>
  );
}

/** Owns the list of active particle bursts; call the returned `spawn` to trigger one. */
export function ParticleField({ bursts, onBurstDone }: { bursts: BurstSpec[]; onBurstDone: (id: number) => void }) {
  return (
    <>
      {bursts.map((b) => (
        <ParticleBurst key={b.id} type={b.type} position={b.position} onDone={() => onBurstDone(b.id)} />
      ))}
    </>
  );
}
