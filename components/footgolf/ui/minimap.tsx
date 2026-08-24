"use client";

import { useGameStore } from "../lib/store";
import type { HoleDefinition, ZoneShape } from "../lib/types";

interface MinimapProps {
  hole: HoleDefinition;
}

/**
 * Renders one water-hazard footprint into the minimap's world-space SVG
 * group (already flipped so +z/pin reads as "up"). Mirrors the shape
 * handling in scene/water.tsx, but as flat 2D SVG instead of 3D geometry.
 */
function HazardShape({ shape }: { shape: ZoneShape }): JSX.Element | null {
  switch (shape.type) {
    case "circle":
      return <circle cx={shape.center[0]} cy={shape.center[1]} r={shape.radius} />;
    case "ellipse":
      return (
        <ellipse
          cx={shape.center[0]}
          cy={shape.center[1]}
          rx={shape.radiusX}
          ry={shape.radiusZ}
          transform={
            shape.rotation ? `rotate(${(-shape.rotation * 180) / Math.PI} ${shape.center[0]} ${shape.center[1]})` : undefined
          }
        />
      );
    case "rect":
      return (
        <rect
          x={shape.center[0] - shape.size[0] / 2}
          y={shape.center[1] - shape.size[1] / 2}
          width={shape.size[0]}
          height={shape.size[1]}
          transform={
            shape.rotation ? `rotate(${(-shape.rotation * 180) / Math.PI} ${shape.center[0]} ${shape.center[1]})` : undefined
          }
        />
      );
    case "polygon":
      return <polygon points={shape.points.map(([x, z]) => `${x},${z}`).join(" ")} />;
    default:
      return null;
  }
}

/**
 * Small always-on top-down schematic of the current hole: bounds, water
 * hazards, tee, pin, and the ball's live position. The low chase camera
 * shows almost nothing of doglegs or hazards ahead — this is the one place
 * a player can actually see the hole's shape before committing to a line.
 */
export function Minimap({ hole }: MinimapProps): JSX.Element {
  const ballX = useGameStore((s) => s.ballMapX);
  const ballZ = useGameStore((s) => s.ballMapZ);

  const { width, depth } = hole.bounds;
  const pad = Math.max(width, depth) * 0.06;
  const viewBox = `${-width / 2 - pad} ${-depth / 2 - pad} ${width + pad * 2} ${depth + pad * 2}`;
  const dotRadius = Math.max(width, depth) * 0.018;

  return (
    <div className="pointer-events-none absolute bottom-5 left-5 z-20 h-32 w-24 overflow-hidden rounded-2xl border border-white/15 bg-slate-950/55 shadow-lg backdrop-blur-xl sm:h-36 sm:w-28">
      <svg viewBox={viewBox} className="h-full w-full" preserveAspectRatio="xMidYMid meet">
        {/* Flip Y so world +z (toward the pin) renders toward the top of the panel. */}
        <g transform="scale(1 -1)">
          <rect
            x={-width / 2}
            y={-depth / 2}
            width={width}
            height={depth}
            rx={pad}
            fill="rgba(255,255,255,0.06)"
            stroke="rgba(255,255,255,0.18)"
            strokeWidth={Math.max(width, depth) * 0.006}
          />

          {hole.waterHazards.map((hazard, i) => (
            <g key={i} fill="rgba(56,155,190,0.75)">
              <HazardShape shape={hazard.shape} />
            </g>
          ))}

          <circle cx={hole.tee[0]} cy={hole.tee[1]} r={dotRadius * 0.9} fill="#f8fafc" stroke="#0f172a" strokeWidth={dotRadius * 0.25} />
          <circle cx={hole.pin[0]} cy={hole.pin[1]} r={dotRadius * 0.9} fill="#ef4444" stroke="#f8fafc" strokeWidth={dotRadius * 0.25} />
          <circle cx={ballX} cy={ballZ} r={dotRadius} fill="#fde047" stroke="#0f172a" strokeWidth={dotRadius * 0.3} />
        </g>
      </svg>
    </div>
  );
}
