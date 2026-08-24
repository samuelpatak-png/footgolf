/**
 * Small procedural sound-effects module for the footgolf game. Everything is
 * synthesized on the fly with oscillators / filtered noise via the WebAudio
 * API — no mp3/wav assets, no network requests.
 *
 * The AudioContext is created lazily (first call to `initAudio()` or any
 * `play*` function) rather than at module load, since constructing one
 * before a user gesture triggers autoplay-policy warnings (and stays
 * "suspended") in Chrome/Safari. Call `initAudio()` from the very first
 * user interaction in the game (e.g. the first pointerdown of an aim drag)
 * to unlock/resume it as early as possible; every `play*` function also
 * defensively re-checks/resumes the context so nothing throws if audio is
 * unavailable or still locked.
 */

import { useGameStore } from "./store";

type AudioContextCtor = typeof AudioContext;

function isMuted(): boolean {
  return useGameStore.getState().muted;
}

/** Lazily-created singleton context, shared by every sound in this module. */
let sharedContext: AudioContext | null = null;
/** Set once if this environment has no usable AudioContext, to avoid retrying. */
let contextUnavailable = false;

function resolveAudioContextCtor(): AudioContextCtor | undefined {
  const globalWindow = window as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return globalWindow.AudioContext ?? globalWindow.webkitAudioContext;
}

/** Returns the shared AudioContext, creating it on first use. Never throws. */
function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (contextUnavailable) return null;
  if (sharedContext) return sharedContext;

  const Ctor = resolveAudioContextCtor();
  if (!Ctor) {
    contextUnavailable = true;
    return null;
  }

  try {
    sharedContext = new Ctor();
  } catch {
    contextUnavailable = true;
    sharedContext = null;
  }
  return sharedContext;
}

/**
 * Fetches the shared context and, if it exists but is suspended (autoplay
 * policy / not yet unlocked by a user gesture), kicks off a resume without
 * awaiting it. Returns null when audio is unavailable so callers can no-op.
 */
function ensurePlayable(): AudioContext | null {
  const ctx = getAudioContext();
  if (!ctx) return null;
  if (ctx.state === "suspended") {
    void ctx.resume().catch(() => {
      // Autoplay policy still blocking us — sounds just stay silent for now.
    });
  }
  return ctx;
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * Creates the shared AudioContext (if needed) and resumes it if suspended.
 * Call this eagerly from the first user gesture in the game (e.g. the first
 * pointerdown of an aim drag) so later `play*` calls are audible immediately.
 */
export function initAudio(): void {
  if (typeof window === "undefined") return;
  ensurePlayable();
}

/**
 * Short, punchy percussive "thump" for kicking the ball — a pitch-dropping
 * low oscillator with a fast exponential decay. `power` (0..1) scales both
 * loudness and punchiness so harder kicks sound bigger.
 */
export function playKick(power: number): void {
  if (typeof window === "undefined" || isMuted()) return;
  const ctx = ensurePlayable();
  if (!ctx) return;

  const amount = clamp01(power);
  const now = ctx.currentTime;
  const attack = 0.002;
  const decay = 0.12 + amount * 0.1; // 120ms..220ms

  const osc = ctx.createOscillator();
  osc.type = "triangle";
  const startFreq = 95 + amount * 55;
  osc.frequency.setValueAtTime(startFreq, now);
  osc.frequency.exponentialRampToValueAtTime(38, now + attack + decay * 0.6);

  const gain = ctx.createGain();
  const peak = 0.22 + amount * 0.55;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(peak, now + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + attack + decay + 0.02);
}

/**
 * Softer, shorter thud for the ball landing/bouncing on the ground.
 * `intensity` (roughly 0..1) scales loudness and pitch drop.
 */
export function playBounce(intensity: number): void {
  if (typeof window === "undefined" || isMuted()) return;
  const ctx = ensurePlayable();
  if (!ctx) return;

  const amount = clamp01(intensity);
  const now = ctx.currentTime;
  const attack = 0.002;
  const decay = 0.045 + amount * 0.06;

  const osc = ctx.createOscillator();
  osc.type = "sine";
  const startFreq = 140 + amount * 70;
  osc.frequency.setValueAtTime(startFreq, now);
  osc.frequency.exponentialRampToValueAtTime(65, now + attack + decay * 0.7);

  const gain = ctx.createGain();
  const peak = 0.06 + amount * 0.22;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(peak, now + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + attack + decay + 0.02);
}

/**
 * Short burst of filtered noise for the ball landing in water — a
 * short-lived noise buffer swept through a bandpass filter with a quick
 * gain envelope.
 */
export function playSplash(): void {
  if (typeof window === "undefined" || isMuted()) return;
  const ctx = ensurePlayable();
  if (!ctx) return;

  const now = ctx.currentTime;
  const duration = 0.35;
  const sampleCount = Math.max(1, Math.floor(ctx.sampleRate * duration));

  const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < sampleCount; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const bandpass = ctx.createBiquadFilter();
  bandpass.type = "bandpass";
  bandpass.Q.value = 0.7;
  bandpass.frequency.setValueAtTime(1100, now);
  bandpass.frequency.exponentialRampToValueAtTime(420, now + duration);

  const lowpass = ctx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = 2600;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.5, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  noise.connect(bandpass);
  bandpass.connect(lowpass);
  lowpass.connect(gain);
  gain.connect(ctx.destination);

  noise.start(now);
  noise.stop(now + duration + 0.02);
}

/**
 * Bright rising three-note chime (major triad, staggered) played when the
 * ball drops into the cup — a small "success" jingle.
 */
export function playHoleIn(): void {
  if (typeof window === "undefined" || isMuted()) return;
  const ctx = ensurePlayable();
  if (!ctx) return;

  const now = ctx.currentTime;
  const notes: ReadonlyArray<{ freq: number; start: number; peak: number; decay: number }> = [
    { freq: 523.25, start: 0, peak: 0.22, decay: 0.35 }, // C5
    { freq: 659.25, start: 0.09, peak: 0.22, decay: 0.35 }, // E5 (major third)
    { freq: 783.99, start: 0.18, peak: 0.26, decay: 0.55 }, // G5 (perfect fifth)
  ];

  for (const note of notes) {
    const t0 = now + note.start;
    const attack = 0.015;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = note.freq;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(note.peak, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + note.decay);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t0);
    osc.stop(t0 + note.decay + 0.05);
  }
}

/**
 * Very short, subtle high click for UI button feedback.
 */
export function playUiClick(): void {
  if (typeof window === "undefined" || isMuted()) return;
  const ctx = ensurePlayable();
  if (!ctx) return;

  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  osc.type = "square";
  osc.frequency.value = 1800;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.12, now + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.04);
}
