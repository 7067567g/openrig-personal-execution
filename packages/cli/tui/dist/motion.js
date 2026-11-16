/** the env kill-switch — any of the accepted flags disables ALL motion */
export function reducedMotion(env = process.env) {
    return env["OPENRIG_REDUCED_MOTION"] === "1" || env["REDUCED_MOTION"] === "1" || env["NO_MOTION"] === "1";
}
/** Quiet command focus: two seconds visible, one off; typing stays steady. */
export function commandFocusVisible(nowMs, editing, reduced) {
    return editing || reduced || nowMs % 3000 < 2000;
}
const BRAILLE_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const LINE_FRAMES = ["|", "/", "-", "\\"];
/** loading spinner: braille frames (truecolor/256), line frames at 16-color,
 * a STATIC dot under reduced motion — the state is still shown, honestly */
export function spinnerFrame(tick, mode, reduced) {
    if (reduced)
        return "·";
    const frames = mode === "16" || mode === "none" ? LINE_FRAMES : BRAILLE_FRAMES;
    return frames[((tick % frames.length) + frames.length) % frames.length];
}
/** tmux-style ONE-SHOT row flash: active only within the window; never under
 * reduced motion */
export function flashActive(sinceMs, nowMs, durationMs = 600, reduced = false) {
    if (reduced)
        return false;
    return nowMs >= sinceMs && nowMs - sinceMs < durationMs;
}
/** quiet DETERMINATE block-bar — REAL fractions only; null/NaN renders
 * nothing (a bar is a claim of measured progress, never fabricated) */
export function barCells(fraction, width) {
    if (fraction == null || Number.isNaN(fraction))
        return "";
    const clamped = Math.min(Math.max(fraction, 0), 1);
    const filled = Math.round(clamped * width);
    return "█".repeat(filled) + "░".repeat(width - filled);
}
//# sourceMappingURL=motion.js.map