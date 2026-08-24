"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import * as THREE from "three";

import { Course } from "./scene/course";
import { HOLES } from "./lib/course-data";
import { useGameStore } from "./lib/store";
import { MainMenu } from "./ui/main-menu";
import { Hud } from "./ui/hud";
import { HoleCompleteOverlay } from "./ui/hole-complete-overlay";
import { ResultsOverlay } from "./ui/results-overlay";

export default function FootgolfGame() {
  const phase = useGameStore((s) => s.phase);
  const holeIndex = useGameStore((s) => s.holeIndex);
  const advanceHole = useGameStore((s) => s.advanceHole);
  const restart = useGameStore((s) => s.restart);

  const hole = HOLES[Math.min(holeIndex, HOLES.length - 1)];

  return (
    <div className="fixed inset-0 h-dvh w-dvw overflow-hidden bg-black">
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        style={{ touchAction: "none" }}
        camera={{ fov: 52, near: 0.1, far: 500, position: [0, 3, 8] }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
        }}
      >
        <Physics gravity={[0, -9.81, 0]}>
          <Suspense fallback={null}>
            <Course key={hole.id} hole={hole} />
          </Suspense>
        </Physics>
      </Canvas>

      {phase === "playing" && <Hud hole={hole} holeNumber={holeIndex + 1} totalHoles={HOLES.length} />}
      {phase === "menu" && <MainMenu />}
      {phase === "holeComplete" && <HoleCompleteOverlay onContinue={() => advanceHole(HOLES.length)} />}
      {phase === "finished" && <ResultsOverlay onRestart={restart} />}
    </div>
  );
}
