"use client";

import { useEffect, useState } from "react";

import { playUiClick } from "../lib/audio";
import { useGameStore, type LoftMode } from "../lib/store";
import type { HoleDefinition } from "../lib/types";

interface HudProps {
  hole: HoleDefinition;
  holeNumber: number;
  totalHoles: number;
}

const LOFT_LABELS: Record<LoftMode, string> = {
  low: "Nízko",
  normal: "Normálne",
  high: "Vysoko",
};

const LOFT_ORDER: readonly LoftMode[] = ["low", "normal", "high"];

/** How long a toast pill stays visible before it fades out again. */
const TOAST_VISIBLE_MS = 2600;

/** Power 0..1 -> hue from green (low) to red (high), for the kick-power bar. */
function powerColor(power: number): string {
  const clamped = Math.min(1, Math.max(0, power));
  const hue = 132 - clamped * 132;
  return `hsl(${hue.toFixed(0)} 82% 52%)`;
}

/**
 * In-game overlay shown while `phase === "playing"`. Purely decorative/
 * informational except for the loft selector and the "back to menu" button,
 * which are the only elements that re-enable pointer events — every other
 * pixel of the HUD must let drag gestures reach the canvas underneath so the
 * native pointer-based aim-and-kick control keeps working.
 */
export function Hud({ hole, holeNumber, totalHoles }: HudProps): JSX.Element {
  const strokes = useGameStore((s) => s.strokes);
  const toast = useGameStore((s) => s.toast);
  const toastId = useGameStore((s) => s.toastId);
  const loft = useGameStore((s) => s.loft);
  const setLoft = useGameStore((s) => s.setLoft);
  const power = useGameStore((s) => s.power);
  const isPulling = useGameStore((s) => s.isPulling);
  const goToMenu = useGameStore((s) => s.goToMenu);
  const windAngle = useGameStore((s) => s.windAngle);
  const windStrength = useGameStore((s) => s.windStrength);
  const restartHole = useGameStore((s) => s.restartHole);
  const muted = useGameStore((s) => s.muted);
  const toggleMuted = useGameStore((s) => s.toggleMuted);

  const [toastText, setToastText] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);

  // Re-trigger the pill's fade-in every time a new toast fires, even if the
  // message text is identical to the previous one, by keying off toastId
  // (which increments on every showToast call) rather than the text itself.
  useEffect(() => {
    if (toast == null) return;
    setToastText(toast);
    setToastVisible(true);
    const hideTimer = setTimeout(() => setToastVisible(false), TOAST_VISIBLE_MS);
    return () => clearTimeout(hideTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toastId]);

  return (
    <div className="pointer-events-none fixed inset-0 z-30">
      {/* Scoreboard chip */}
      <div className="absolute left-4 top-4 z-20 w-[calc(100vw-5.5rem)] max-w-xs sm:left-5 sm:top-5 sm:w-auto sm:max-w-sm">
        <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-2.5 shadow-xl backdrop-blur-xl sm:px-5 sm:py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300/80">
              Jamka {holeNumber}/{totalHoles}
            </p>
            <p className="truncate text-sm font-bold text-white sm:text-base">{hole.name}</p>
          </div>
          <div className="ml-auto flex items-center gap-3 border-l border-white/10 pl-3">
            <div className="text-center">
              <p className="text-[9px] font-semibold uppercase tracking-wide text-white/45">Par</p>
              <p className="text-base font-extrabold text-sky-300 sm:text-lg">{hole.par}</p>
            </div>
            <div className="text-center">
              <p className="text-[9px] font-semibold uppercase tracking-wide text-white/45">Údery</p>
              <p className="text-base font-extrabold text-amber-300 sm:text-lg">{strokes}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Wind */}
      <div className="absolute left-4 top-[4.7rem] z-20 sm:left-5 sm:top-[5.2rem]">
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/50 px-3 py-1.5 shadow-lg backdrop-blur-xl">
          {windStrength > 0.08 ? (
            <>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-3.5 w-3.5 shrink-0 text-sky-300"
                style={{ transform: `rotate(${windAngle}rad)` }}
              >
                <path
                  d="M12 3v18M12 3l-5 5M12 3l5 5"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="text-[11px] font-semibold text-white/70">
                Vietor {(windStrength * 8).toFixed(1)} m/s
              </span>
            </>
          ) : (
            <span className="text-[11px] font-semibold text-white/50">Bezvetrie</span>
          )}
        </div>
      </div>

      {/* Top-right action cluster: mute, restart hole, back to menu */}
      <div className="pointer-events-auto absolute right-4 top-4 z-20 flex items-center gap-2 sm:right-5 sm:top-5">
        <button
          type="button"
          onClick={() => {
            toggleMuted();
            // zustand's set() is synchronous, so by now the store already
            // reflects the new muted state — playUiClick() will only
            // actually be heard when this toggle just turned sound on.
            playUiClick();
          }}
          aria-label={muted ? "Zapnúť zvuk" : "Stlmiť zvuk"}
          title={muted ? "Zapnúť zvuk" : "Stlmiť zvuk"}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-slate-950/50 text-white/60 shadow-lg backdrop-blur-xl transition hover:bg-slate-900/70 hover:text-white"
        >
          {muted ? (
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
              <path
                d="M11 5 6 9H3v6h3l5 4V5Z"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M17 9l5 6M22 9l-5 6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
              <path
                d="M11 5 6 9H3v6h3l5 4V5Z"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
              />
            </svg>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            playUiClick();
            restartHole();
          }}
          aria-label="Reštartovať jamku"
          title="Reštartovať jamku"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-slate-950/50 text-white/60 shadow-lg backdrop-blur-xl transition hover:bg-slate-900/70 hover:text-white"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
            <path
              d="M4 4v5h5M20 20v-5h-5M19.5 9A7.5 7.5 0 0 0 6.2 6.2M4.5 15a7.5 7.5 0 0 0 13.3 2.8"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => {
            playUiClick();
            goToMenu();
          }}
          aria-label="Späť do menu"
          title="Späť do menu"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-slate-950/50 text-white/60 shadow-lg backdrop-blur-xl transition hover:bg-slate-900/70 hover:text-white"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
            <path
              d="M15 6l-6 6 6 6"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {/* Toast (e.g. penalty messages) */}
      {toastText && (
        <div
          className={`absolute left-1/2 top-20 z-20 -translate-x-1/2 transition-all duration-300 ease-out sm:top-24 ${
            toastVisible ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
          }`}
        >
          <div className="whitespace-nowrap rounded-full border border-amber-400/30 bg-amber-500/15 px-4 py-2 text-xs font-semibold text-amber-200 shadow-lg backdrop-blur-xl sm:text-sm">
            {toastText}
          </div>
        </div>
      )}

      {/* Live power readout while charging a kick */}
      {isPulling && (
        <div className="absolute bottom-24 left-1/2 z-20 w-60 -translate-x-1/2 sm:bottom-28 sm:w-72">
          <div className="rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-2.5 shadow-lg backdrop-blur-xl">
            <div className="mb-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-white/55">
              <span>Sila kopu</span>
              <span>{Math.round(Math.min(1, Math.max(0, power)) * 100)}%</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full transition-[width] duration-75 ease-out"
                style={{
                  width: `${Math.min(1, Math.max(0, power)) * 100}%`,
                  backgroundColor: powerColor(power),
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Loft selector */}
      <div className="pointer-events-auto absolute bottom-5 right-5 z-20 flex items-center gap-1 rounded-full border border-white/15 bg-slate-950/60 p-1 shadow-lg backdrop-blur-xl">
        {LOFT_ORDER.map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => {
              if (mode !== loft) playUiClick();
              setLoft(mode);
            }}
            className={`rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition sm:text-xs ${
              loft === mode
                ? "bg-gradient-to-r from-emerald-500 to-sky-500 text-white shadow"
                : "text-white/55 hover:text-white"
            }`}
          >
            {LOFT_LABELS[mode]}
          </button>
        ))}
      </div>
    </div>
  );
}
