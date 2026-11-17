/** Sentinel file a fixture home drops to mark itself as fixture-scoped. */
export declare const FIXTURE_HOME_MARKER = ".openrig-fixture";
/** S1 marker relative to an OPENRIG_HOME. */
export declare const MANAGED_RUN_MARKER: string;
/** Single-launch authorization relative to an OPENRIG_HOME. */
export declare const LAUNCH_RECORD_PATH: string;
/**
 * S9 W-S8-10 — the append-only verb-claim ledger. One file per verb inside a
 * per-launch directory, created with `O_CREAT|O_EXCL`; the kernel picks exactly one
 * winner across processes, so token consumption is atomic and a failed claim can only
 * ever DENY.
 *
 * The launchId is part of the path because a NEW `openrig-run start` is a NEW
 * authorization: claims from the previous launch must not deny the next one. Inside one
 * launch the claim is permanent.
 */
export declare const CONSUMED_LEDGER_DIR: string;
/** Human/audit mirror of the claims (append-only; never the gate). */
export declare const CONSUMED_LEDGER_LOG: string;
export type HomeKind = "fixture" | "managed" | "run-shaped" | "other";
export type EntryMode = "entry" | "recovery" | "remote" | "not_entry";
export type EntryVerb = "daemon-start" | "up" | "restore-apply" | "workflow-instantiate" | "workflow-instantiate-lifecycle" | "workflow-run" | "snapshot-create" | "archive" | "unarchive" | "compact" | "seat-launch" | "seat-restart" | "seat-stop" | "seat-clean" | "seat-handover" | "seat-continue" | "workflow-route" | "workflow-resume" | "workflow-abort" | "workflow-revision" | "workflow-project" | "release" | "attach" | "add-member" | "grow" | "expand" | "shrink" | "remove-node" | "launch-node" | "create" | "import-rig" | "adopt" | "fork" | "bind" | "bootstrap" | "bundle-install" | "reconcile-session" | "unclaim" | "seat-clear-attention" | "seat-resume-token";
export type LaunchPhase = "starting" | "active" | "closed";
/**
 * Every recognized lifecycle-entry verb. Classification may identify these verbs,
 * and a launch record may explicitly authorize them, but recognition is not
 * authorization: only DEFAULT_LAUNCH_VERBS is granted to a supervisor launch.
 */
export declare const ENTRY_VERBS: readonly EntryVerb[];
/**
 * The six startup verbs a supervisor launch authorizes exactly once.
 *
 * Single-consumption is intentional: a launch ticket authorizes one daemon boot,
 * one `up`, one restore, etc. Adding a recognized lifecycle verb must NOT silently
 * grant it to every launch; such a verb is denied until a launch record explicitly
 * includes it (or a documented escape hatch is used).
 */
export declare const STARTUP_LAUNCH_VERBS: readonly EntryVerb[];
/**
 * S10 r3 S1-2 — managed workflow-continuation verbs.
 *
 * A managed seat closes its workflow steps by calling `rig workflow project` (and may
 * route/resume/abort/revise) many times after the one-shot startup phase. Treating
 * these like startup verbs consumed the token on the first step and denied every
 * later step. They are therefore repeatable WITHIN one launch record: every call
 * still passes the home/TTL/phase/token/runId predicates and the verb must still be
 * present in `record.verbs`, but it does not claim the single-use ledger.
 *
 * This is a scoped continuation channel, not a general bypass: it is bound to the
 * same live launch record as the startup verbs and expires/closed together with it.
 */
export declare const CONTINUATION_VERBS: readonly EntryVerb[];
/**
 * The verbs an `openrig-run start` supervisor launch authorizes by default
 * (D-S8-05, extended by S10 r3 S1-2): the six single-use startup verbs plus the
 * repeatable workflow-continuation verbs. The list is deliberately independent of
 * ENTRY_VERBS: recognizing a lifecycle verb must not silently grant it here.
 */
export declare const DEFAULT_LAUNCH_VERBS: readonly EntryVerb[];
/** True for the repeatable, launch-scoped workflow-continuation class. */
export declare function isContinuationVerb(verb: EntryVerb): boolean;
/**
 * Deliberate L0 exclusions — accepted risk, NOT a claim that these commands are
 * safe. They stay outside the lifecycle-entry classifier so supervisor stop and
 * rollback paths keep working:
 * - `down`: the L3 `/api/down` admission plus the stop lease is the actual
 *   mutation boundary; L0 must not pre-empt supervisor stop/rollback.
 * - `daemon stop`: stops the local control plane only; it does not directly kill
 *   a rig, seat, or workflow, and supervisor stop/rollback needs it.
 * - `destroy`: disaster-recovery path gated by explicit `--yes` plus the exact
 *   confirmation token; outside the ordinary lifecycle guard.
 */
export declare const ACCEPTED_RISK_CLI_COMMANDS: readonly ["down", "daemon stop", "destroy"];
export interface EntryClassification {
    mode: EntryMode;
    verb: EntryVerb | null;
}
export interface ConsumedVerb {
    verb: EntryVerb;
    at: string;
    pid: number;
}
export interface LaunchRecord {
    schemaVersion: 1;
    launchId: string;
    home: string;
    runId: string;
    phase: LaunchPhase;
    expiresAt: string;
    verbs: EntryVerb[];
    consumed: ConsumedVerb[];
    /** S9 W-S8-14 — a dry-run record never authorizes anything, whatever its phase. */
    dryRun?: boolean;
    [key: string]: unknown;
}
export interface LaunchRecordRead {
    ok: boolean;
    record?: LaunchRecord;
    code?: string;
    reason?: string;
}
export interface EntryCheckInput {
    /**
     * Command tail AFTER the node/script prefix and after `--allow-direct` has been
     * stripped: `["up", "/tmp/rig.yaml", "--plan"]`. The adapter owns argv[0..1].
     */
    argv: readonly string[];
    home: string;
    env: Record<string, string | undefined>;
    now?: Date;
    /** Set by the CLI after pre-parse stripping (flag before OR after the command). */
    allowDirect?: boolean;
    allowDirectReason?: string;
    /** Verbs already consumed by THIS process (L0 then L1 in `rig daemon start`). */
    alreadyConsumed?: readonly string[];
    pid?: number;
}
export interface EntryDecision {
    allow: boolean;
    code: string | null;
    reason: string;
    verb: EntryVerb | null;
    mode: EntryMode;
    homeKind: HomeKind;
    warn: boolean;
    launchId: string | null;
}
export interface DaemonBootInput {
    home: string;
    env: Record<string, string | undefined>;
    now?: Date;
    pid?: number;
}
export type AuditDecision = "deny" | "allow_entry" | "allow_override" | "allow_recovery" | "warn";
export interface EntryAuditRecord {
    ts: string;
    decision: AuditDecision;
    code: string | null;
    verb: EntryVerb | null;
    argv: string[];
    runId: string | null;
    launchId: string | null;
    home: string;
    uid: number | string;
    pid: number;
}
declare function safeRealpath(path: string): string;
/** Same-path comparison used by every layer (L0–L3) before a home match is accepted. */
export { safeRealpath };
/** Same semantics as `packages/cli/src/openrig-compat.ts:isFixtureScopedHome` (copied, not imported). */
export declare function isFixtureScopedHome(home: string): boolean;
/**
 * Classify an OPENRIG_HOME. Order is significant: fixture > managed > run-shaped > other.
 * A marker whose JSON is corrupt still counts as `managed` (fail-closed).
 */
export declare function classifyHome(home: string): HomeKind;
/**
 * Step 0 — pure argv classification. `argv` is the command tail (no node/script).
 * Returns `not_entry` for anything not in the recognized lifecycle table.
 * `--` ends option/flag parsing, but the tokens after it still participate in
 * command/subcommand and positional discovery, matching Commander.
 */
export declare function classifyEntryVerb(argv: readonly string[]): EntryClassification;
/**
 * Read and validate `entry/launch.json`. Exactly 8 fields participate (S6 W-19):
 * schemaVersion, launchId, home, runId, phase, expiresAt, verbs, consumed.
 */
export declare function readLaunchRecord(home: string): LaunchRecordRead;
/**
 * S9 W-S8-10 — the append-only claim ledger.
 *
 * `claimVerb` is the ONLY gate for token consumption: it creates `entry/consumed/<verb>`
 * with `O_CREAT|O_EXCL`, so of N concurrent processes exactly one wins. A loser is
 * denied with `entry_guard_verb_consumed`; any failure to persist the winning claim is
 * also a DENY. There is no path from a failed write back to an allow (the S8 fail-open).
 *
 * S10 r3 denied-claim fix: a claim is PROVISIONAL until both the claim file contents
 * and the append-only ledger line are durable. If a post-create write fails, the
 * provisional claim file is unlinked before returning the deny, so a denied attempt
 * does not silently spend the one-shot token. Concurrency is unchanged: O_EXCL still
 * chooses exactly one winner, and a concurrent loser observes EEXIST and denies. If
 * the kernel refuses the unlink, the result says `tokenSpent: true` rather than
 * pretending the denial left the token available.
 */
export interface VerbClaimInput {
    home: string;
    verb: EntryVerb;
    launchId: string;
    pid?: number;
    at?: string;
}
export interface VerbClaimResult {
    ok: boolean;
    code?: string;
    reason?: string;
    /**
     * Present only on a deny where this attempt left a live claim file behind. The
     * caller must treat that as "token spent despite the deny" and report it.
     */
    tokenSpent?: boolean;
}
/**
 * A launch-scoped directory name that cannot escape the home. `launch-<uuid>` is
 * unchanged; anything exotic is folded to `_` and would then only ever produce a
 * fail-closed collision, never a traversal.
 */
export declare function ledgerScope(launchId: string): string;
/** Where one launch's claim for `verb` lives. */
export declare function ledgerClaimPath(home: string, launchId: string, verb: string): string;
/**
 * Verbs already claimed BY THIS LAUNCH. A read error yields an empty set on purpose:
 * the atomic claim — not this read — is the gate, and a claim attempt still fails
 * closed.
 */
export declare function readConsumedLedger(home: string, launchId: string): Set<string>;
/**
 * Atomically claim `verb` for one launch. Any failure returns `ok: false`.
 *
 * The O_EXCL file is the race gate. Both the claim file content and the human/audit
 * ledger line are written before the claim becomes final; if either write fails the
 * provisional claim file is removed. The ledger line is a mirror, never the gate, so
 * a released claim leaves the token available even if an append was partially written.
 */
export declare function claimVerb(input: VerbClaimInput): VerbClaimResult;
/** First 8 argv tokens, with `--env` values redacted. */
export declare function redactArgv(argv: readonly string[]): string[];
/**
 * Append one audit line. BEST-EFFORT and never creates a directory: if `home/entry`
 * does not exist the line is skipped, so a deny can still claim zero mutation (D-S8-06).
 */
export declare function appendAudit(home: string, entry: Omit<EntryAuditRecord, "ts" | "uid" | "pid"> & {
    ts?: string;
    uid?: number | string;
    pid?: number;
}): void;
/**
 * Step 0–14. Read-only except for the explicit audit append and (on allow at step 14b)
 * the single-use verb claim. A deny may create a provisional claim while racing, but
 * claimVerb releases it before returning a deny unless the kernel refuses the unlink
 * (then the deny explicitly reports that the token is spent).
 */
export declare function checkEntry(input: EntryCheckInput): EntryDecision;
/**
 * L2 daemon boot self-check. Only managed (S1) homes are judged; S2 stays a pass with
 * no marker (D-S8-04). The check validates the record but NEVER consumes a verb, because
 * the daemon boot is not an entry verb — it is proof that a valid launch is still live.
 */
export declare function checkDaemonBoot(input: DaemonBootInput): EntryDecision;
//# sourceMappingURL=entry-guard.d.ts.map