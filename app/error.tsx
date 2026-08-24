"use client";

import { useEffect } from "react";

/**
 * Next.js's default production error screen ("Application error: a
 * client-side exception has occurred") deliberately hides the actual error
 * to avoid leaking server internals — but this app is 100% client-rendered
 * (the game canvas opts out of SSR entirely), so there's nothing sensitive
 * to hide here. Owning this boundary surfaces the real message/stack
 * directly on screen instead of sending players to the browser console.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950 p-6 text-center text-white">
      <div className="text-5xl">⚠️</div>
      <h1 className="text-xl font-bold">Niečo sa pokazilo</h1>
      <p className="max-w-lg whitespace-pre-wrap break-words rounded-xl border border-white/10 bg-white/5 p-4 text-left font-mono text-xs text-white/70">
        {error.message || "(bez správy)"}
        {error.stack ? `\n\n${error.stack}` : ""}
      </p>
      {error.digest && <p className="text-xs text-white/40">digest: {error.digest}</p>}
      <button
        type="button"
        onClick={reset}
        className="mt-2 rounded-full bg-gradient-to-r from-emerald-500 to-sky-400 px-6 py-2.5 text-sm font-bold uppercase tracking-wide text-emerald-950"
      >
        Skúsiť znova
      </button>
    </div>
  );
}
