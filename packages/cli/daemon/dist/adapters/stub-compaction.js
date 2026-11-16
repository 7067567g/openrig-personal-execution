// OPR.0.5.1.1 — the stub COMPACTION behavior executor (A5 items 6-8).
//
// PRD §4.3/§4.4 (arch R3, binding): the stub TRIGGERS the exact shipped compaction
// seam, it never FABRICATES its outputs. On an `emit compaction` script step the runner
// calls fireCompaction, which spawns the REAL precompact-hook.mjs — the same product
// asset a real Claude seat runs at PreCompact — so it writes the seat-keyed
// restore-pending marker the real compaction-restore-bridge later delivers. The observable
// (a real keyed marker + generated packet) is production-identical, and deterministic
// under the shared injectable clock (OPENRIG_TEST_CLOCK_NOW).
//
// Effectful by nature (it spawns a subprocess); kept separate from the pure stub-script
// model so that model stays hermetic.
import nodeFs from "node:fs";
import nodePath from "node:path";
import { spawnSync } from "node:child_process";
/** Loud, typed failure — a missing hook or a seam that produced no marker must fail,
 *  never a silent skip that leaves the seat looking compaction-clean. */
export class StubCompactionError extends Error {
    constructor(message) {
        super(message);
        this.name = "StubCompactionError";
    }
}
/** The marker key sanitizer — MUST match precompact-hook.mjs / compaction-restore-bridge.cjs
 *  (identical character class) so the marker the seam writes is the one we resolve. */
function sanitizeKey(value) {
    return value.replace(/[^a-zA-Z0-9_.@-]/g, "_");
}
/** Fire the real precompact seam for a stub seat and return the marker it wrote. */
export function fireCompaction(opts) {
    // HIGH-6 existence contract: never invoke a phantom hook; fail fast and loud.
    if (!nodeFs.existsSync(opts.hookScriptPath)) {
        throw new StubCompactionError(`precompact hook script not found: ${opts.hookScriptPath}`);
    }
    const hookInput = { cwd: opts.cwd };
    if (opts.transcriptPath)
        hookInput.transcript_path = opts.transcriptPath;
    const env = {
        ...process.env,
        OPENRIG_HOME: opts.openrigHome,
        OPENRIG_SESSION_NAME: opts.sessionName,
        // Don't let a stray RIGGED_HOME pre-empt the isolated OPENRIG_HOME.
        RIGGED_HOME: undefined,
        OPENRIG_TEST_CLOCK_NOW: opts.injectClockNow,
    };
    const result = spawnSync(process.execPath, [opts.hookScriptPath], {
        input: JSON.stringify(hookInput),
        encoding: "utf8",
        env,
    });
    if (result.status !== 0) {
        throw new StubCompactionError(`precompact hook exited ${result.status}: ${(result.stderr || result.stdout || "unknown error").trim()}`);
    }
    const markerPath = nodePath.join(opts.openrigHome, "compaction", "restore-pending", `${sanitizeKey(opts.sessionName)}.json`);
    if (!nodeFs.existsSync(markerPath)) {
        // The seam ran but produced no marker (e.g. packet generation failed) — the stub
        // must surface that, not report a phantom compaction.
        throw new StubCompactionError(`precompact hook produced no restore-pending marker at ${markerPath}`);
    }
    return { markerPath };
}
//# sourceMappingURL=stub-compaction.js.map