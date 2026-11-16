import type { ColorMode } from "./theme.js";
/** the env kill-switch — any of the accepted flags disables ALL motion */
export declare function reducedMotion(env?: NodeJS.ProcessEnv): boolean;
/** Quiet command focus: two seconds visible, one off; typing stays steady. */
export declare function commandFocusVisible(nowMs: number, editing: boolean, reduced: boolean): boolean;
/** loading spinner: braille frames (truecolor/256), line frames at 16-color,
 * a STATIC dot under reduced motion — the state is still shown, honestly */
export declare function spinnerFrame(tick: number, mode: ColorMode, reduced: boolean): string;
/** tmux-style ONE-SHOT row flash: active only within the window; never under
 * reduced motion */
export declare function flashActive(sinceMs: number, nowMs: number, durationMs?: number, reduced?: boolean): boolean;
/** quiet DETERMINATE block-bar — REAL fractions only; null/NaN renders
 * nothing (a bar is a claim of measured progress, never fabricated) */
export declare function barCells(fraction: number | null, width: number): string;
//# sourceMappingURL=motion.d.ts.map