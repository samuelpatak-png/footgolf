"use client";

import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { useGameStore } from "../lib/store";

interface AimControllerProps {
  enabled: boolean;
  baseYaw: number;
  onKick: (yaw: number, power: number) => void;
}

const YAW_SENSITIVITY = 0.0062;
const MAX_PULL_PX = 190;
const MIN_POWER_TO_KICK = 0.05;
const KEY_YAW_STEP = 0.045;

/**
 * "Pull back and release" input, the classic mobile-golf gesture: drag down
 * (away from the target) to charge power, drag sideways to aim, release to
 * kick. Listens on the canvas' own DOM element with pointer capture so the
 * gesture keeps tracking even if the pointer leaves the element, and stays
 * independent of the HUD (which uses pointer-events:none except its buttons).
 * Arrow keys + space are wired as an accessible/desktop-friendly fallback.
 */
export function AimController({ enabled, baseYaw, onKick }: AimControllerProps) {
  const { gl } = useThree();
  const drag = useRef<{ pointerId: number; startX: number; startY: number; yawAtStart: number } | null>(null);
  const keyCharging = useRef(false);
  const keyYaw = useRef(baseYaw);

  useEffect(() => {
    if (!drag.current) {
      useGameStore.getState().setAim(baseYaw, 0);
      keyYaw.current = baseYaw;
    }
  }, [baseYaw]);

  useEffect(() => {
    const el = gl.domElement;

    function onPointerDown(e: PointerEvent) {
      if (!enabled || drag.current) return;
      const { aimYaw } = useGameStore.getState();
      drag.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, yawAtStart: aimYaw };
      el.setPointerCapture(e.pointerId);
      useGameStore.getState().setPulling(true);
    }

    function onPointerMove(e: PointerEvent) {
      const d = drag.current;
      if (!d || e.pointerId !== d.pointerId) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      const yaw = d.yawAtStart - dx * YAW_SENSITIVITY;
      const power = Math.max(0, Math.min(1, dy / MAX_PULL_PX));
      useGameStore.getState().setAim(yaw, power);
    }

    function release(e: PointerEvent) {
      const d = drag.current;
      if (!d || e.pointerId !== d.pointerId) return;
      const { aimYaw, power } = useGameStore.getState();
      drag.current = null;
      useGameStore.getState().setPulling(false);
      if (power >= MIN_POWER_TO_KICK) onKick(aimYaw, power);
      useGameStore.getState().setAim(aimYaw, 0);
    }

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", release);
    el.addEventListener("pointercancel", release);
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", release);
      el.removeEventListener("pointercancel", release);
    };
  }, [gl, enabled, onKick]);

  // Keyboard fallback: arrows to aim, hold space to charge, release to kick.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!enabled) return;
      if (e.code === "ArrowLeft" || e.code === "ArrowRight") {
        const dir = e.code === "ArrowLeft" ? 1 : -1;
        keyYaw.current += dir * KEY_YAW_STEP;
        const { power } = useGameStore.getState();
        useGameStore.getState().setAim(keyYaw.current, power);
      } else if (e.code === "Space" && !keyCharging.current && !drag.current) {
        e.preventDefault();
        keyCharging.current = true;
        useGameStore.getState().setPulling(true);
        useGameStore.getState().setAim(keyYaw.current, 0);
      }
    }

    function onKeyUp(e: KeyboardEvent) {
      if (e.code === "Space" && keyCharging.current) {
        keyCharging.current = false;
        useGameStore.getState().setPulling(false);
        const { power } = useGameStore.getState();
        if (power >= MIN_POWER_TO_KICK) onKick(keyYaw.current, power);
        useGameStore.getState().setAim(keyYaw.current, 0);
      }
    }

    let raf = 0;
    function chargeLoop() {
      if (keyCharging.current) {
        const { power } = useGameStore.getState();
        useGameStore.getState().setAim(keyYaw.current, Math.min(1, power + 0.014));
      }
      raf = requestAnimationFrame(chargeLoop);
    }
    raf = requestAnimationFrame(chargeLoop);

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      cancelAnimationFrame(raf);
    };
  }, [enabled, onKick]);

  return null;
}
