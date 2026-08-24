"use client";

import { Component, type ReactNode } from "react";
import { GameCrashFallback } from "./game-crash-fallback";

interface GameErrorBoundaryProps {
  children: ReactNode;
}

interface GameErrorBoundaryState {
  error: unknown;
}

/**
 * Catches render/effect-time crashes from the game canvas (most notably
 * THREE.WebGLRenderer throwing synchronously when a WebGL context can't be
 * created) so one bad device/browser combination shows a recoverable
 * message instead of Next's generic full-page error screen. Must be a class
 * component — React has no hook-based error boundary API.
 */
export class GameErrorBoundary extends Component<GameErrorBoundaryProps, GameErrorBoundaryState> {
  state: GameErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): GameErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: unknown): void {
    console.error("Footgolf game crashed:", error);
  }

  render() {
    if (this.state.error) return <GameCrashFallback error={this.state.error} />;
    return this.props.children;
  }
}
