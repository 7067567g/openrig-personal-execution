/** The locked four-behavior repertoire (arch A4 terminal descope). Shared, byte-for-byte,
 *  with 51-02's EMIT_BEHAVIORS. usage_limit is deliberately absent — real-runtime-only. */
export declare const STUB_BEHAVIORS: readonly ["compaction", "slow_output", "mid_turn_death", "restore"];
export type StubBehavior = (typeof STUB_BEHAVIORS)[number];
/** Known-but-real-runtime-only behaviors: a stub cannot honestly feed the provider-usage
 *  lane, so the script model REFUSES them loudly (never accept-and-drop). Mirrors 51-02's
 *  REAL_RUNTIME_ONLY_EMIT_BEHAVIORS so a stub script and a stub scenario agree. */
export declare const REAL_RUNTIME_ONLY_BEHAVIORS: readonly ["usage_limit"];
/** A single deterministic script step. */
export type StubStep = {
    kind: "say";
    text: string;
} | {
    kind: "emit";
    behavior: StubBehavior;
};
export interface StubScript {
    steps: StubStep[];
}
/** Loud, typed rejection — a malformed/dishonest script must fail, never silently no-op. */
export declare class StubScriptError extends Error {
    constructor(message: string);
}
/** Parse + validate a stub script from its JSON string. Throws StubScriptError on any
 *  malformation so a bad script fails loudly at load, not with a silent partial run. */
export declare function parseStubScript(raw: string): StubScript;
/** The built-in default script for a standalone stub seat (no scenario-resolved script):
 *  prompt + echo + a scripted reply, so the seat produces observable pane output. */
export declare const DEFAULT_STUB_SCRIPT: StubScript;
//# sourceMappingURL=stub-script.d.ts.map