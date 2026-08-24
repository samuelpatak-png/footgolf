"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette, HueSaturation, BrightnessContrast } from "@react-three/postprocessing";
import { createSunGlowTexture } from "../lib/textures";

interface SkyEnvironmentProps {
  bounds: { width: number; depth: number };
}

// Late-morning sun: fairly high in the sky, coming in from the south-east-ish.
const SUN_ELEVATION_DEG = 45;
const SUN_AZIMUTH_DEG = 130;
const SUN_DISTANCE = 300;

// Close to the pale blue a clear sky fades to near the horizon, so distant
// terrain dissolves into the backdrop instead of showing a hard edge.
const FOG_COLOR = "#cfe3ef";

// A stylized (not physically-based) gradient dome: a saturated zenith blue
// easing into the same pale tone the fog uses at the horizon, so the sky and
// the point where the terrain fades out read as one continuous surface.
const SKY_ZENITH_COLOR = "#1f6fc4";
const SKY_HORIZON_COLOR = FOG_COLOR;
const SKY_GROUND_COLOR = "#4b5a4f";
const SKY_RADIUS = SUN_DISTANCE * 1.4;

const CLOUD_COUNT = 4;

const skyVertexShader = /* glsl */ `
  varying vec3 vWorldPosition;
  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const skyFragmentShader = /* glsl */ `
  uniform vec3 topColor;
  uniform vec3 horizonColor;
  uniform vec3 groundColor;
  varying vec3 vWorldPosition;
  void main() {
    float h = normalize(vWorldPosition).y;
    vec3 col = h >= 0.0
      ? mix(horizonColor, topColor, pow(h, 0.55))
      : mix(horizonColor, groundColor, pow(-h, 0.4));
    gl_FragColor = vec4(col, 1.0);
  }
`;

/**
 * Converts elevation/azimuth (degrees) into a world-space direction vector,
 * matching the convention drei's <Sky> expects for `sunPosition`.
 */
function sunDirectionFromAngles(elevationDeg: number, azimuthDeg: number, distance: number): THREE.Vector3 {
  const phi = THREE.MathUtils.degToRad(90 - elevationDeg);
  const theta = THREE.MathUtils.degToRad(azimuthDeg);
  const vector = new THREE.Vector3();
  vector.setFromSphericalCoords(distance, phi, theta);
  return vector;
}

/** Cheap deterministic 0..1 hash, seeded from stable inputs (cloud index + sub-index). */
function hash(seed: number, n: number): number {
  const s = Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453123;
  return s - Math.floor(s);
}

interface CloudPuffConfig {
  base: THREE.Vector3;
  driftAmplitude: number;
  driftSpeed: number;
  driftPhase: number;
  scale: number;
}

/** Relative offsets/scales of the small spheres that lump together into one cloud "puff". */
const PUFF_LAYOUT: ReadonlyArray<readonly [number, number, number, number]> = [
  [0, 0, 0, 1],
  [0.72, 0.12, 0.08, 0.72],
  [-0.68, 0.05, -0.12, 0.68],
  [0.18, 0.28, 0.55, 0.58],
  [-0.22, 0.22, -0.5, 0.62],
  [0.3, -0.08, -0.42, 0.5],
];

function buildCloudConfigs(bounds: { width: number; depth: number }): CloudPuffConfig[] {
  const span = Math.max(bounds.width, bounds.depth);
  const configs: CloudPuffConfig[] = [];
  for (let i = 0; i < CLOUD_COUNT; i++) {
    const seed = i * 91.7 + 13;
    const angle = (i / CLOUD_COUNT) * Math.PI * 2 + hash(seed, 1) * 0.8;
    const radius = span * (0.3 + hash(seed, 2) * 0.3);
    const height = 45 + hash(seed, 3) * 22;
    configs.push({
      base: new THREE.Vector3(Math.cos(angle) * radius, height, Math.sin(angle) * radius),
      driftAmplitude: 6 + hash(seed, 4) * 9,
      driftSpeed: 0.012 + hash(seed, 5) * 0.014,
      driftPhase: hash(seed, 6) * Math.PI * 2,
      scale: 8 + hash(seed, 7) * 6,
    });
  }
  return configs;
}

interface CloudPuffProps {
  config: CloudPuffConfig;
  geometry: THREE.IcosahedronGeometry;
  material: THREE.Material;
}

/** One soft cumulus blob made of a few overlapping low-poly spheres, drifting slowly in a bounded loop. */
function CloudPuff({ config, geometry, material }: CloudPuffProps): JSX.Element {
  const group = useRef<THREE.Group>(null);

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const t = state.clock.elapsedTime * config.driftSpeed + config.driftPhase;
    g.position.set(
      config.base.x + Math.sin(t) * config.driftAmplitude,
      config.base.y,
      config.base.z + Math.cos(t * 0.7) * config.driftAmplitude * 0.6
    );
  });

  return (
    <group ref={group} scale={config.scale}>
      {PUFF_LAYOUT.map(([ox, oy, oz, s], i) => (
        <mesh key={i} geometry={geometry} material={material} position={[ox, oy, oz]} scale={s} />
      ))}
    </group>
  );
}

/**
 * Self-contained outdoor daylight rig for the footgolf scene: procedural sky,
 * a matching directional sun with shadows sized to the hole's bounds, soft
 * ambient/hemisphere fill, distance fog blending into the horizon, a few
 * drifting procedural clouds, and subtle broadcast-style post-processing.
 * Everything is generated in code — no textures, HDRIs, or network fetches.
 */
export function SkyEnvironment({ bounds }: SkyEnvironmentProps): JSX.Element {
  const sunPosition = useMemo(
    () => sunDirectionFromAngles(SUN_ELEVATION_DEG, SUN_AZIMUTH_DEG, SUN_DISTANCE),
    []
  );

  const shadow = useMemo(() => {
    const halfExtent = Math.max(bounds.width, bounds.depth) / 2 + 12;
    return { halfExtent, near: 1, far: SUN_DISTANCE * 1.5 };
  }, [bounds.width, bounds.depth]);

  const fogFar = useMemo(() => Math.max(bounds.width, bounds.depth) * 1.6 + 60, [bounds.width, bounds.depth]);
  const fogNear = useMemo(() => Math.max(bounds.width, bounds.depth) * 0.55, [bounds.width, bounds.depth]);

  const cloudConfigs = useMemo(() => buildCloudConfigs(bounds), [bounds]);
  const cloudGeometry = useMemo(() => new THREE.IcosahedronGeometry(1, 1), []);
  const cloudMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#ffffff",
        roughness: 1,
        metalness: 0,
        transparent: true,
        opacity: 0.88,
        depthWrite: false,
      }),
    []
  );

  const skyUniforms = useMemo(
    () => ({
      topColor: { value: new THREE.Color(SKY_ZENITH_COLOR) },
      horizonColor: { value: new THREE.Color(SKY_HORIZON_COLOR) },
      groundColor: { value: new THREE.Color(SKY_GROUND_COLOR) },
    }),
    []
  );

  const sunGlowTexture = useMemo(() => createSunGlowTexture(), []);
  const sunSpritePosition = useMemo(() => sunPosition.clone().multiplyScalar(0.97), [sunPosition]);

  return (
    <>
      {/* Stylized gradient sky dome, painted from the inside — a deliberate
          art-directed look rather than a physically-based atmosphere, so it
          stays visually consistent with the flat-shaded/procedural props. */}
      <mesh renderOrder={-2}>
        <sphereGeometry args={[SKY_RADIUS, 24, 16]} />
        <shaderMaterial
          side={THREE.BackSide}
          depthWrite={false}
          fog={false}
          uniforms={skyUniforms}
          vertexShader={skyVertexShader}
          fragmentShader={skyFragmentShader}
        />
      </mesh>

      {/* Visible sun disc so the light rig reads as coming from somewhere. */}
      <sprite position={sunSpritePosition} scale={[38, 38, 1]} renderOrder={-1}>
        <spriteMaterial
          map={sunGlowTexture}
          transparent
          depthWrite={false}
          fog={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>

      <fog attach="fog" args={[FOG_COLOR, fogNear, fogFar]} />

      <directionalLight
        position={sunPosition}
        intensity={3.3}
        color="#fff6e8"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-shadow.halfExtent}
        shadow-camera-right={shadow.halfExtent}
        shadow-camera-top={shadow.halfExtent}
        shadow-camera-bottom={-shadow.halfExtent}
        shadow-camera-near={shadow.near}
        shadow-camera-far={shadow.far}
        shadow-bias={-0.0015}
      />

      <hemisphereLight color="#bfe0f7" groundColor="#4a5a3f" intensity={0.5} />
      <ambientLight intensity={0.1} />

      <group>
        {cloudConfigs.map((config, i) => (
          <CloudPuff key={i} config={config} geometry={cloudGeometry} material={cloudMaterial} />
        ))}
      </group>

      <EffectComposer multisampling={4}>
        <Bloom luminanceThreshold={0.88} intensity={0.4} mipmapBlur />
        <HueSaturation saturation={0.12} />
        <BrightnessContrast brightness={0} contrast={0.08} />
        <Vignette eskil={false} offset={0.15} darkness={0.5} />
      </EffectComposer>
    </>
  );
}
