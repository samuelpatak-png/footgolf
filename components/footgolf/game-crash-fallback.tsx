"use client";

interface GameCrashFallbackProps {
  error?: unknown;
}

function isWebglError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /webgl/i.test(message);
}

/**
 * Shown in place of the game canvas when it can't run — either a WebGL
 * context genuinely couldn't be created (hardware acceleration off, an
 * exhausted/blocklisted GPU, a very old device) or some other unexpected
 * render crash. Distinguishes the two so the WebGL case gets actionable
 * troubleshooting instead of a generic "something broke" message.
 */
export function GameCrashFallback({ error }: GameCrashFallbackProps): JSX.Element {
  const webgl = isWebglError(error);

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-y-auto bg-gradient-to-b from-sky-950 via-slate-950 to-emerald-950 p-4">
      <div className="w-full max-w-md rounded-[2rem] border border-white/15 bg-slate-950/70 p-8 text-center shadow-2xl shadow-black/40 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-red-500 text-3xl shadow-lg shadow-red-500/20">
          {webgl ? "🖥️" : "⚠️"}
        </div>

        <h1 className="mt-4 text-xl font-black text-white">
          {webgl ? "Prehliadač nedokáže spustiť 3D grafiku" : "Hra sa nepodarila spustiť"}
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-white/70">
          {webgl
            ? "Footgolf potrebuje WebGL, ktoré je práve v tomto prehliadači alebo zariadení nedostupné či vypnuté."
            : "Nastala neočakávaná chyba pri spúšťaní hry."}
        </p>

        {webgl && (
          <ul className="mt-4 space-y-1.5 rounded-2xl border border-white/10 bg-white/5 p-4 text-left text-xs text-white/60">
            <li>• Skús najnovšiu verziu Chrome, Edge alebo Firefox</li>
            <li>• Skontroluj, či je v prehliadači zapnuté hardvérové zrýchlenie</li>
            <li>• Zavri iné náročné 3D alebo video záložky a skús to znova</li>
            <li>• Skús to na inom zariadení alebo počítači</li>
          </ul>
        )}

        {!webgl && error instanceof Error && (
          <p className="mt-4 whitespace-pre-wrap break-words rounded-xl border border-white/10 bg-white/5 p-3 text-left font-mono text-[11px] text-white/50">
            {error.message}
          </p>
        )}

        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 w-full rounded-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-sky-400 py-3 text-sm font-extrabold uppercase tracking-wide text-emerald-950 shadow-lg shadow-emerald-500/30 transition hover:brightness-110 active:scale-[0.98]"
        >
          Skúsiť znova
        </button>
      </div>
    </div>
  );
}
