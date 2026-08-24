/**
 * Tiny localStorage-backed best-score tracker. Best-effort only: every read
 * and write is wrapped so a private-browsing tab or disabled storage just
 * means scores aren't remembered, never a crash.
 */

const BEST_TOTAL_KEY = "footgolf-best-total";
const bestHoleKey = (holeId: number) => `footgolf-best-hole-${holeId}`;

function readNumber(key: string): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeNumber(key: string, value: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Ignore — best score just won't persist this session.
  }
}

export function getBestTotal(): number | null {
  return readNumber(BEST_TOTAL_KEY);
}

export function getBestForHole(holeId: number): number | null {
  return readNumber(bestHoleKey(holeId));
}

/** Records a finished round's total strokes; returns true if it's a new best. */
export function saveBestTotal(totalStrokes: number): boolean {
  const prev = getBestTotal();
  if (prev !== null && totalStrokes >= prev) return false;
  writeNumber(BEST_TOTAL_KEY, totalStrokes);
  return true;
}

/** Records a single hole's strokes; returns true if it's a new best for that hole. */
export function saveBestForHole(holeId: number, strokes: number): boolean {
  const prev = getBestForHole(holeId);
  if (prev !== null && strokes >= prev) return false;
  writeNumber(bestHoleKey(holeId), strokes);
  return true;
}
