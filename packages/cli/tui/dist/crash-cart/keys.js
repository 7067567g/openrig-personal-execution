import { evaluateOneClickGate } from "./one-click-gate.js";
/** Map a key ("s"/"i"/"n"/"r"/"enter") to a crash-cart action for the active daemon-down screen, or
 *  null (not a crash-cart key here → falls through to normal TUI handling). */
export function resolveCrashCartKey(key, opts) {
    if (opts.unavailable)
        return key === "r" ? "retry" : key === "d" ? "details" : null;
    if (opts.daemonState === "down") {
        const firstRun = opts.crashCart?.mode === "first-run";
        if (key === "s")
            return "start-daemon";
        if (key === "n")
            return "onboarding";
        if (!firstRun && key === "i")
            return "inspect";
        if (!firstRun && key === "enter") {
            // H2 — CONSULT the one-click gate: ⏎ is a single keystroke ONLY when the restore plan is
            // zero-generation. Any rig with non-resumable seats routes to the confirm path (names the deltas).
            const gate = evaluateOneClickGate({
                foundOnHost: (opts.crashCart?.foundOnHost ?? []).map((r) => ({
                    rigName: r.name,
                    seatCount: r.seatCount,
                    resumableCount: r.resumableCount,
                })),
            });
            return gate.zeroGeneration ? "restore" : "restore-confirm";
        }
        return null;
    }
    if (opts.daemonState === "unverified") {
        return key === "r" ? "retry" : null;
    }
    return null;
}
//# sourceMappingURL=keys.js.map