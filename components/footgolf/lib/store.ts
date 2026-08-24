import { create } from "zustand";

export type GamePhase = "menu" | "playing" | "holeComplete" | "finished";
export type LoftMode = "low" | "normal" | "high";

export interface HoleResult {
  holeId: number;
  name: string;
  par: number;
  strokes: number;
}

interface GameState {
  phase: GamePhase;
  holeIndex: number;
  strokes: number;
  results: HoleResult[];

  /** True once the ball has come to rest and the player may aim/kick again. */
  canShoot: boolean;
  isBallMoving: boolean;

  /** Live drag-to-aim state, updated at pointer-move frequency for the HUD. */
  aimYaw: number;
  power: number;
  isPulling: boolean;
  loft: LoftMode;

  toast: string | null;
  toastId: number;

  startGame: () => void;
  goToMenu: () => void;
  restart: () => void;
  addStroke: () => void;
  setCanShoot: (v: boolean) => void;
  setBallMoving: (v: boolean) => void;
  showToast: (msg: string) => void;
  setAim: (yaw: number, power: number) => void;
  setPulling: (v: boolean) => void;
  setLoft: (loft: LoftMode) => void;
  completeHole: (holeId: number, name: string, par: number) => void;
  advanceHole: (totalHoles: number) => void;

  /** Per-hole wind, rerolled whenever a hole (re)mounts. */
  windAngle: number;
  windStrength: number;
  rollWind: () => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  phase: "menu",
  holeIndex: 0,
  strokes: 0,
  results: [],

  canShoot: false,
  isBallMoving: false,

  aimYaw: 0,
  power: 0,
  isPulling: false,
  loft: "normal",

  toast: null,
  toastId: 0,

  windAngle: 0,
  windStrength: 0,

  startGame: () =>
    set({
      phase: "playing",
      holeIndex: 0,
      strokes: 0,
      results: [],
      canShoot: false,
      isBallMoving: false,
      toast: null,
    }),

  goToMenu: () => set({ phase: "menu" }),

  restart: () =>
    set({
      phase: "playing",
      holeIndex: 0,
      strokes: 0,
      results: [],
      canShoot: false,
      isBallMoving: false,
      toast: null,
    }),

  addStroke: () => set((s) => ({ strokes: s.strokes + 1 })),
  setCanShoot: (v) => set({ canShoot: v }),
  setBallMoving: (v) => set({ isBallMoving: v }),

  showToast: (msg) => set((s) => ({ toast: msg, toastId: s.toastId + 1 })),

  setAim: (yaw, power) => set({ aimYaw: yaw, power }),
  setPulling: (v) => set({ isPulling: v }),
  setLoft: (loft) => set({ loft }),

  completeHole: (holeId, name, par) =>
    set((s) => ({
      phase: "holeComplete",
      results: [...s.results, { holeId, name, par, strokes: s.strokes }],
    })),

  advanceHole: (totalHoles) => {
    const { holeIndex } = get();
    if (holeIndex + 1 >= totalHoles) {
      set({ phase: "finished" });
    } else {
      set({
        phase: "playing",
        holeIndex: holeIndex + 1,
        strokes: 0,
        canShoot: false,
        isBallMoving: false,
        toast: null,
      });
    }
  },

  rollWind: () =>
    set({
      windAngle: Math.random() * Math.PI * 2,
      // Skewed toward calmer wind (sqrt) so a strong gust is a notable event, not the norm.
      windStrength: Math.sqrt(Math.random()),
    }),
}));
