"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { GameCrashFallback } from "./game-crash-fallback";
import { GameErrorBoundary } from "./game-error-boundary";

const FootgolfGame = dynamic(() => import("./game"), {
  ssr: false,
  loading: () => <LoadingScreen />,
});

function LoadingScreen() {
  return (
    <div className="fixed inset-0 flex h-dvh w-dvw items-center justify-center bg-gradient-to-b from-sky-800 via-sky-950 to-emerald-950">
      <div className="text-center text-white">
        <div className="mb-3 text-5xl">⛳</div>
        <div className="text-2xl font-semibold tracking-wide">Footgolf</div>
        <div className="mt-2 text-sm text-white/60">Načítavam ihrisko…</div>
      </div>
    </div>
  );
}

/**
 * Cheap synchronous probe: can this browser/device create a WebGL context
 * at all? Checked before the (heavy) game bundle even mounts, so a device
 * without WebGL gets an instant, actionable message instead of downloading
 * three.js/Rapier only to have THREE.WebGLRenderer throw on construction.
 */
function detectWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl") || canvas.getContext("experimental-webgl"));
  } catch {
    return false;
  }
}

export function FootgolfLoader() {
  const [webglOk, setWebglOk] = useState<boolean | null>(null);

  useEffect(() => {
    setWebglOk(detectWebGL());
  }, []);

  if (webglOk === null) return <LoadingScreen />;
  if (!webglOk) return <GameCrashFallback error={new Error("WebGL context could not be created")} />;

  return (
    <GameErrorBoundary>
      <FootgolfGame />
    </GameErrorBoundary>
  );
}
