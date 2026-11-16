// OPR.0.5.1.1 — the shared, PURE contract between the stub runtime adapter and the
// pane-hosted stub-runner process (A5 / ContextMonitor settlement).
//
// Everything here is side-effect-free (constants + the readiness-sidecar shape +
// string/argv builders) so the pane-hosted runner entry can import it without
// dragging daemon dependencies into the pane process, and the adapter tests can
// assert command construction hermetically. Mirrors the proven pi-runner-protocol
// shape (OPR.0.4.6.PI1): a Pi-shaped node-script runner with a self-invocation guard.
//
// Contract summary:
// - The adapter launches `node <runnerEntry> …` inside the seat's tmux pane.
// - The runner writes the readiness sidecar `<cwd>/.openrig/stub/state.json` and
//   prints the READY marker to the pane; the daemon reads ONLY runner-authored
//   surfaces (the sidecar), never pane heuristics, for the readiness decision.
// - Step-4 scope: the runner becomes ready + persists the readiness sidecar. The
//   four seeded behaviors {compaction, slow_output, mid_turn_death, restore} and
//   the ctx% context sidecar land in later increments (A5 items 5-8).
import nodePath from "node:path";
import { shellQuote } from "./shell-quote.js";
// ── Readiness sidecar layout ────────────────────────────────────────────────
// <cwd>/.openrig/stub/state.json → the runner's readiness sidecar (the daemon's
// authoritative liveness source; distinct from the ctx% context sidecar under
// <OPENRIG_HOME>/context/ consumed by ContextUsageStore in a later increment).
export const STUB_READINESS_SIDECAR_SUBPATH = nodePath.join(".openrig", "stub", "state.json");
/** Absolute path to the readiness sidecar for a seat whose managed cwd is `cwd`. */
export function stubSeatSidecarPath(cwd) {
    return nodePath.join(cwd, STUB_READINESS_SIDECAR_SUBPATH);
}
// ── Scenario-resolved behavior script ───────────────────────────────────────
// <cwd>/.openrig/stub/script.json → the per-seat behavior script the runner
// executes (pane outputs + hook/behavior emissions; PRD §4.2). A scenario harness
// (51-02) drops it into the managed cwd; a standalone stub seat has none and the
// runner falls back to the built-in DEFAULT_STUB_SCRIPT. A cwd convention (not a
// launch flag) so the launch command stays byte-stable across fresh/resume.
export const STUB_SCRIPT_SUBPATH = nodePath.join(".openrig", "stub", "script.json");
/** Absolute path to the scenario-resolved behavior script for a seat whose managed
 *  cwd is `cwd` (absent = the runner uses DEFAULT_STUB_SCRIPT). */
export function stubSeatScriptPath(cwd) {
    return nodePath.join(cwd, STUB_SCRIPT_SUBPATH);
}
// ── Pane markers (runner-authored; the adapter greps for THESE, never harness UI) ─
export const STUB_RUNNER_READY_MARKER = "[stub-runner] READY";
export const STUB_RUNNER_EXIT_MARKER = "[stub-runner] EXITED";
export const STUB_RUNNER_ERROR_MARKER = "[stub-runner] ERROR";
/** Parse a readiness sidecar. Requires only `ready: boolean` (a minimal
 *  `{"ready": true}` fixture is valid); everything else is optional metadata. */
export function parseStubRunnerState(raw) {
    try {
        const parsed = JSON.parse(raw);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
            return null;
        const state = parsed;
        if (typeof state.ready !== "boolean")
            return null;
        return parsed;
    }
    catch {
        return null;
    }
}
/** The command typed into the seat's tmux pane. The runner owns everything past
 *  this boundary (sidecar write, behavior simulation, mirror). */
export function buildStubRunnerCommand(opts) {
    const parts = [
        "node",
        shellQuote(opts.runnerEntryPath),
        "--session-name", shellQuote(opts.sessionName),
        "--cwd", shellQuote(opts.cwd),
        "--launch-id", shellQuote(opts.launchId),
        "--posture", shellQuote(opts.posture),
    ];
    if (opts.resumeToken) {
        parts.push("--session", shellQuote(opts.resumeToken));
    }
    return parts.join(" ");
}
//# sourceMappingURL=stub-runner-protocol.js.map