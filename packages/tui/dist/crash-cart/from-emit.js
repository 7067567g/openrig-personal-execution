import { buildCrashCartModel } from "./crash-cart-model.js";
/** A refusal is an unavailable read, never an empty instance. */
export function crashCartRenderOpts(emit) {
    if (emit.refusal)
        return { unavailable: emit.refusal };
    if (emit.state === "down" && emit.discovery) {
        return { daemonState: "down", crashCart: buildCrashCartModel(emit.discovery) };
    }
    if (emit.state === "unverified" && emit.evidence) {
        return { daemonState: "unverified", daemonEvidence: emit.evidence };
    }
    return {};
}
/**
 * Run the public read. Failure is visible and does not authorize recovery effects.
 */
export async function probeCrashCart(runVerb) {
    try {
        const emit = JSON.parse(await runVerb());
        if (!emit || !["up", "down", "unverified"].includes(emit.state)) {
            const error = emit;
            const detail = typeof error?.error === "string" ? error.error : error?.error?.message;
            return { unavailable: detail ?? "Crash-cart did not return a daemon verdict." };
        }
        if (emit.state === "down" && !emit.discovery && !emit.refusal)
            return { unavailable: "Daemon is down; its saved state could not be read." };
        if (emit.state === "unverified" && !emit.evidence)
            return { unavailable: "Daemon state could not be verified; probe evidence is unavailable." };
        return crashCartRenderOpts(emit);
    }
    catch (error) {
        return { unavailable: `Startup prerequisite unavailable: ${error instanceof Error ? error.message : String(error)}` };
    }
}
//# sourceMappingURL=from-emit.js.map