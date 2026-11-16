import { type StubScript } from "./stub-script.js";
import { type CompactionResult } from "./stub-compaction.js";
import { type RestoreResult } from "./stub-restore.js";
export interface StubRunnerArgs {
    sessionName: string;
    cwd: string;
    launchId: string;
    posture: "floor" | "full_bypass" | "auto";
    resumeToken?: string;
}
/** Parse the runner argv (the flags buildStubRunnerCommand emits). Pure. */
export declare function parseStubRunnerArgs(argv: string[]): StubRunnerArgs;
export interface StubRunnerIO {
    /** Print one line to the seat's pane. */
    mirrorLine(line: string): void;
    /** Fire the REAL precompact seam (arch R3: TRIGGER, never fabricate) and return
     *  the seat-keyed restore-pending marker it wrote. */
    fireCompaction(): CompactionResult;
    /** Fire the REAL restore reader (compaction-restore-bridge.cjs) — arch R3: TRIGGER,
     *  never fabricate — and return the injected restore directive it delivered (or a
     *  delivered=false no-op when there is no pending marker to deliver). */
    fireRestore(): RestoreResult;
    /** Fire-and-forget POST of a canonical activity event to /api/activity/hooks. */
    postActivity(payload: Record<string, unknown>): void;
    /** Kill the seat MID-TURN (mid_turn_death): record the exited sidecar + EXIT marker,
     *  then terminate the process. The real runner never returns from this. */
    die(code: number): void;
    /** Injectable clock (OPENRIG_TEST_CLOCK_NOW when set, real wall-clock otherwise). */
    now(): string;
}
/** mid_turn_death's exit code — 128+SIGKILL(9), the conventional "process killed" code,
 *  evoking a seat struck down mid-turn. Deterministic + distinct from the error paths. */
export declare const STUB_MID_TURN_DEATH_EXIT_CODE = 137;
/** The seat's activity identity (mirror pi-runner). runtime is always "stub". */
export interface StubActivityIdentity {
    sessionName: string;
    nodeId?: string;
}
/** Build a canonical /api/activity/hooks payload — the SAME field shape the real
 *  runtimes POST ({runtime, sessionName, nodeId, hookEvent, subtype?, occurredAt}),
 *  so the stub's events drive agent-activity-store state identically. */
export declare function stubActivityPayload(identity: StubActivityIdentity, hookEvent: string, subtype: string | null, occurredAt: string): Record<string, unknown>;
/** slow_output's fixed chunk count — the "scripted rate" as a deterministic multi-part
 *  pane sequence (no wall-clock, no new leak-vector pacer var). */
export declare const SLOW_OUTPUT_CHUNKS = 3;
/** Execute a stub behavior script step-by-step against the injected IO seam. Pure
 *  dispatch — no filesystem/clock of its own — so a fake IO drives it hermetically.
 *  A script is ONE turn: it opens with a UserPromptSubmit activity (running) and
 *  closes with Stop (idle) — the observable state transition the 51-02 scenario
 *  harness reads. `say` mirrors its text; `emit compaction` fires the real seam; a
 *  not-yet-wired behavior mirrors an HONEST deferral (never a silent no-op). */
export declare function executeStubScript(script: StubScript, io: StubRunnerIO, identity: StubActivityIdentity): void;
/** Resolve the seat's behavior script: the scenario-resolved script at
 *  <cwd>/.openrig/stub/script.json when present, else the built-in default. A
 *  malformed scenario script fails LOUDLY (parseStubScript throws) — never a silent
 *  fallback to the default that would mask a broken scenario. */
export declare function resolveStubScript(cwd: string, fsLike: {
    readFile(p: string): string;
    exists(p: string): boolean;
}): StubScript;
/** Build the stub seat's OWN session transcript (a real JSONL) from its script. The
 *  compaction seam MUST compact this, never a foreign transcript: restore-from-jsonl's
 *  findLatestJsonl falls back to ~/.claude/projects, so without an explicit own
 *  transcript the stub would non-deterministically compact whatever latest transcript
 *  exists on the box. Authoring + passing this is what makes the compaction honest
 *  (the stub compacts its scripted conversation) and deterministic. */
export declare function buildStubTranscript(script: StubScript, ctx: {
    sessionName: string;
    cwd: string;
    sessionId: string;
}): string;
/** Resolve the shipped precompact-hook.mjs the compaction behavior fires. An env
 *  override (OPENRIG_STUB_PRECOMPACT_HOOK) wins for hermetic tests; otherwise the
 *  packaged asset relative to this entry — the SAME relative path from src/adapters
 *  (tsx) and dist/adapters (compiled), matching the daemon's asset-resolution idiom. */
export declare function resolveStubHookScriptPath(env?: NodeJS.ProcessEnv): string;
/** Resolve the shipped compaction-restore-bridge.cjs the restore behavior fires. An env
 *  override (OPENRIG_STUB_RESTORE_BRIDGE) wins for hermetic tests; otherwise the packaged
 *  asset relative to this entry — the SAME relative path from src/adapters (tsx) and
 *  dist/adapters (compiled), matching the daemon's asset-resolution idiom. */
export declare function resolveStubRestoreBridgePath(env?: NodeJS.ProcessEnv): string;
/** Resolve the daemon's activity endpoint (mirror pi-runner): env first
 *  (OPENRIG_URL + OPENRIG_ACTIVITY_HOOK_TOKEN, or OPENRIG_HOST:OPENRIG_PORT), then
 *  the <OPENRIG_HOME>/activity-endpoint.json fallback. Returns null when neither is
 *  available — activity POSTs then no-op (the sidecar + pane still work). */
export declare function resolveStubActivityEndpoint(env: NodeJS.ProcessEnv): {
    baseUrl: string;
    token: string;
} | null;
/** The loud stderr line both the stub runner AND the shipped precompact hook emit when
 *  OPENRIG_TEST_CLOCK_NOW is active. A leaked test-clock var silently FREEZES production
 *  timestamps; this makes any leak visible in seat logs (safety, per review-r1's
 *  escalation). MUST stay byte-identical to the literal in precompact-hook.mjs. */
export declare const STUB_CLOCK_ANNOUNCEMENT = "OPENRIG_TEST_CLOCK_NOW active \u2014 timestamps are injected";
export declare function runStubRunner(args: StubRunnerArgs): Promise<void>;
//# sourceMappingURL=stub-runner.d.ts.map