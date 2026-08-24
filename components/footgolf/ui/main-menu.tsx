"use client";

import type { ReactNode } from "react";

import { useGameStore } from "../lib/store";

/**
 * Full-screen title card shown while `phase === "menu"`. Sits directly on
 * top of the live 3D scene (rendered underneath by <Canvas>), so the panel
 * itself stays translucent/blurred rather than opaque to let the course
 * show through around it for a "broadcast intro" feel.
 */
export function MainMenu(): JSX.Element {
  const startGame = useGameStore((s) => s.startGame);

  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center overflow-hidden p-4">
      {/* Ambient wash + glow so the menu reads as an overlay, not a solid screen. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-sky-950/30 via-transparent to-emerald-950/50"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[42rem] w-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400/10 blur-3xl"
      />

      <div className="pointer-events-auto relative w-full max-w-md rounded-[2rem] border border-white/15 bg-slate-950/55 p-8 text-center shadow-2xl shadow-black/40 backdrop-blur-2xl sm:p-10">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-300">
          ⛳ Arkádový golf
        </span>

        <h1 className="mt-5 bg-gradient-to-r from-emerald-300 via-teal-200 to-sky-300 bg-clip-text text-6xl font-black uppercase leading-none tracking-tighter text-transparent sm:text-7xl">
          Footgolf
        </h1>

        <p className="mt-4 text-sm leading-relaxed text-white/70 sm:text-base">
          Tri jamky, jedna loptička, žiadne palice. Trafte grín na čo najmenej kopov a zapíšte sa medzi šampiónov.
        </p>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-left">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-sky-300/90">Ako hrať</p>
          <p className="text-xs leading-relaxed text-white/70 sm:text-sm">
            Potiahnite myšou (alebo prstom) dozadu od loptičky – nabijete tak silu aj smer kopu. Pustením tlačidla
            kopnete. Ovládať sa dá aj šípkami pre smer a medzerníkom pre silu kopu.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-white/50">
            <Kbd>←</Kbd>
            <Kbd>→</Kbd>
            <span className="mr-2">smer</span>
            <Kbd>Medzerník</Kbd>
            <span>sila a kop</span>
          </div>
        </div>

        <button
          type="button"
          onClick={startGame}
          className="mt-8 w-full rounded-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-sky-400 py-3.5 text-lg font-extrabold uppercase tracking-wide text-emerald-950 shadow-lg shadow-emerald-500/30 transition hover:brightness-110 active:scale-[0.98]"
        >
          Hrať
        </button>
      </div>
    </div>
  );
}

function Kbd({ children }: { children: ReactNode }): JSX.Element {
  return (
    <kbd className="rounded-md border border-white/15 bg-white/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white/80">
      {children}
    </kbd>
  );
}
