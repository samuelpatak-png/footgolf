"use client";

import dynamic from "next/dynamic";

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

export function FootgolfLoader() {
  return <FootgolfGame />;
}
