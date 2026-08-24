"use client";

import { useEffect, useState } from "react";

import { playUiClick } from "../lib/audio";
import { saveBestTotal } from "../lib/scores";
import { useGameStore } from "../lib/store";

interface ResultsOverlayProps {
  onRestart: () => void;
}

function formatDiff(diff: number): string {
  if (diff === 0) return "E";
  return diff > 0 ? `+${diff}` : `${diff}`;
}

function diffToneClass(diff: number): string {
  if (diff < 0) return "text-emerald-300";
  if (diff === 0) return "text-sky-300";
  return "text-red-300";
}

/**
 * Full-round scorecard shown when `phase === "finished"`, built from
 * `store.results` (one entry per completed hole, pushed by completeHole()).
 */
export function ResultsOverlay({ onRestart }: ResultsOverlayProps): JSX.Element {
  const results = useGameStore((s) => s.results);

  const totalPar = results.reduce((sum, r) => sum + r.par, 0);
  const totalStrokes = results.reduce((sum, r) => sum + r.strokes, 0);
  const totalDiff = totalStrokes - totalPar;

  const [isNewBest, setIsNewBest] = useState(false);

  useEffect(() => {
    if (results.length === 0) return;
    setIsNewBest(saveBestTotal(totalStrokes));
    // Only re-evaluate when a fresh set of results lands (i.e. a round just finished).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results]);

  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="pointer-events-auto w-full max-w-lg rounded-[2rem] border border-white/15 bg-slate-950/75 p-6 shadow-2xl shadow-black/40 backdrop-blur-2xl sm:p-8">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-3xl shadow-lg shadow-amber-500/30">
            🏆
          </div>
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-300/80">
            Kolo dokončené
          </p>
          <h2 className="mt-1 text-3xl font-black text-white">Výsledková listina</h2>

          {isNewBest && (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-amber-300/40 bg-amber-400/15 px-3.5 py-1.5 text-xs font-extrabold uppercase tracking-wide text-amber-200">
              🏆 Nové osobné maximum!
            </div>
          )}

          <div className="mt-5 inline-flex items-center gap-6 rounded-2xl border border-white/10 bg-white/5 px-6 py-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-white/45">Údery spolu</p>
              <p className="mt-0.5 text-2xl font-extrabold text-amber-300">{totalStrokes}</p>
            </div>
            <div className="h-8 w-px bg-white/15" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-white/45">Par</p>
              <p className="mt-0.5 text-2xl font-extrabold text-sky-300">{totalPar}</p>
            </div>
            <div className="h-8 w-px bg-white/15" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-white/45">+/-</p>
              <p className={`mt-0.5 text-2xl font-extrabold ${diffToneClass(totalDiff)}`}>{formatDiff(totalDiff)}</p>
            </div>
          </div>
        </div>

        {results.length > 0 ? (
          <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[420px] border-collapse text-left text-sm">
              <thead>
                <tr className="bg-white/5 text-[10px] uppercase tracking-wide text-white/45">
                  <th className="px-4 py-2.5 font-semibold">Jamka</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Par</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Údery</th>
                  <th className="px-4 py-2.5 text-right font-semibold">+/-</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => {
                  const diff = r.strokes - r.par;
                  return (
                    <tr key={r.holeId} className={i % 2 === 0 ? "bg-white/[0.02]" : ""}>
                      <td className="px-4 py-2.5 font-medium text-white">{r.name}</td>
                      <td className="px-4 py-2.5 text-right text-white/70">{r.par}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-amber-300">{r.strokes}</td>
                      <td className={`px-4 py-2.5 text-right font-bold ${diffToneClass(diff)}`}>
                        {formatDiff(diff)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-white/15 bg-white/5">
                  <td className="px-4 py-2.5 font-extrabold uppercase tracking-wide text-white">Spolu</td>
                  <td className="px-4 py-2.5 text-right font-extrabold text-sky-300">{totalPar}</td>
                  <td className="px-4 py-2.5 text-right font-extrabold text-amber-300">{totalStrokes}</td>
                  <td className={`px-4 py-2.5 text-right font-extrabold ${diffToneClass(totalDiff)}`}>
                    {formatDiff(totalDiff)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <p className="mt-6 text-center text-sm text-white/60">Žiadne odohrané jamky.</p>
        )}

        <button
          type="button"
          onClick={() => {
            playUiClick();
            onRestart();
          }}
          className="mt-7 w-full rounded-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-sky-400 py-3.5 text-base font-extrabold uppercase tracking-wide text-emerald-950 shadow-lg shadow-emerald-500/30 transition hover:brightness-110 active:scale-[0.98]"
        >
          Hrať znova
        </button>
      </div>
    </div>
  );
}
