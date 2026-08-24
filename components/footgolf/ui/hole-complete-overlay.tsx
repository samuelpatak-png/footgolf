"use client";

import { useGameStore } from "../lib/store";

interface HoleCompleteOverlayProps {
  onContinue: () => void;
}

interface RelativeTerm {
  label: string;
  badgeClass: string;
}

/** Slovak golf terminology for strokes relative to par. */
function relativeTerm(diff: number): RelativeTerm {
  if (diff <= -2) return { label: "Orol", badgeClass: "border-amber-300/40 bg-amber-400/15 text-amber-200" };
  if (diff === -1) return { label: "Birdie", badgeClass: "border-emerald-300/40 bg-emerald-400/15 text-emerald-200" };
  if (diff === 0) return { label: "Par", badgeClass: "border-sky-300/40 bg-sky-400/15 text-sky-200" };
  if (diff === 1) return { label: "Bogey", badgeClass: "border-orange-300/40 bg-orange-400/15 text-orange-200" };
  if (diff === 2) {
    return { label: "Double bogey", badgeClass: "border-orange-400/50 bg-orange-500/15 text-orange-200" };
  }
  return { label: "Triple bogey+", badgeClass: "border-red-400/50 bg-red-500/20 text-red-200" };
}

function formatDiff(diff: number): string {
  if (diff === 0) return "E";
  return diff > 0 ? `+${diff}` : `${diff}`;
}

/**
 * Centered glass card shown when `phase === "holeComplete"`, summarizing the
 * hole that was just finished (the last entry pushed onto `store.results`).
 * The game scene keeps rendering behind it, dimmed and blurred.
 */
export function HoleCompleteOverlay({ onContinue }: HoleCompleteOverlayProps): JSX.Element {
  const results = useGameStore((s) => s.results);
  const last = results[results.length - 1];

  const name = last?.name ?? "";
  const par = last?.par ?? 0;
  const strokes = last?.strokes ?? 0;
  const diff = strokes - par;
  const { label, badgeClass } = relativeTerm(diff);

  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div className="pointer-events-auto w-full max-w-sm rounded-[2rem] border border-white/15 bg-slate-950/70 p-8 text-center shadow-2xl shadow-black/40 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-sky-500 text-3xl shadow-lg shadow-emerald-500/30">
          ⛳
        </div>

        <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-300/80">
          Jamka dokončená
        </p>
        <h2 className="mt-1 text-2xl font-black text-white">{name}</h2>

        <div className={`mt-5 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 ${badgeClass}`}>
          <span className="text-sm font-extrabold uppercase tracking-wide">{label}</span>
          <span className="text-sm font-bold opacity-80">({formatDiff(diff)})</span>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-white/45">Par</p>
            <p className="mt-0.5 text-xl font-extrabold text-sky-300">{par}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-white/45">Údery</p>
            <p className="mt-0.5 text-xl font-extrabold text-amber-300">{strokes}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-white/45">+/-</p>
            <p className="mt-0.5 text-xl font-extrabold text-white">{formatDiff(diff)}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onContinue}
          className="mt-7 w-full rounded-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-sky-400 py-3 text-base font-extrabold uppercase tracking-wide text-emerald-950 shadow-lg shadow-emerald-500/30 transition hover:brightness-110 active:scale-[0.98]"
        >
          Pokračovať
        </button>
      </div>
    </div>
  );
}
