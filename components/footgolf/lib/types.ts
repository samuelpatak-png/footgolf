/**
 * Shared types describing a footgolf hole. A single source of truth used by
 * both the physics (terrain collider) and the rendering (terrain mesh,
 * texture blending, obstacle placement) so the two can never drift apart.
 */

export type SurfaceType =
  | "tee"
  | "fairway"
  | "rough"
  | "green"
  | "sand"
  | "water"
  | "cartpath";

export type Vec2 = readonly [x: number, z: number];

export type TerrainFeature =
  | {
      kind: "bump";
      center: Vec2;
      radiusX: number;
      radiusZ: number;
      /** Positive raises terrain, negative carves a basin (e.g. under a pond). */
      height: number;
    }
  | {
      kind: "ridge";
      from: Vec2;
      to: Vec2;
      width: number;
      height: number;
    }
  | {
      kind: "slope";
      /** Unit-ish direction the terrain rises toward. */
      dir: Vec2;
      /** Height gained per world unit travelled along `dir`. */
      strength: number;
    }
  | {
      kind: "noise";
      amplitude: number;
      frequency: number;
      seed?: number;
    };

export type ZoneShape =
  | { type: "circle"; center: Vec2; radius: number }
  | { type: "ellipse"; center: Vec2; radiusX: number; radiusZ: number; rotation?: number }
  | { type: "rect"; center: Vec2; size: Vec2; rotation?: number }
  | { type: "polygon"; points: Vec2[] };

export interface SurfaceZone {
  surface: SurfaceType;
  shape: ZoneShape;
  /** Higher priority wins when zones overlap. */
  priority?: number;
}

export interface WaterHazard {
  shape: ZoneShape;
  /** World-space Y of the water surface. */
  level: number;
}

export type ObstacleType =
  | "pineTree"
  | "roundTree"
  | "rock"
  | "rockCluster"
  | "bush"
  | "reeds"
  | "postMarker";

export interface ObstacleDef {
  type: ObstacleType;
  position: Vec2;
  scale?: number;
  rotation?: number;
  variant?: number;
}

export interface HoleDefinition {
  id: number;
  name: string;
  description: string;
  par: number;
  tee: Vec2;
  pin: Vec2;
  /** Yaw (radians) the camera/aim starts facing, roughly tee -> pin. */
  startYaw: number;
  bounds: { width: number; depth: number };
  baseHeight: number;
  terrain: TerrainFeature[];
  surfaceZones: SurfaceZone[];
  waterHazards: WaterHazard[];
  obstacles: ObstacleDef[];
  cupRadius: number;
}
