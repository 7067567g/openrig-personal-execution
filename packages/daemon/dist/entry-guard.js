/**
 * S8 Wave A — managed-run entry guard CORE.
 *
 * Pure classification + file reading. NO commander / CLI imports: this module is
 * consumed by the daemon (boot self-check) and published to the CLI through the
 * narrow `entry-guard-surface.ts` re-export. The decision order is frozen in
 * `runs/openrig-s8-entry-guard-20261116/reports/EXECUTION-TREE-S8.md` §4.2 —
 * implement against that table, not against a paraphrase.
 *
 * Design constraints (see EXECUTION-TREE-S8.md §4):
 *  - evaluate BEFORE any lifecycle mutation; a deny is exit 2 with zero writes;
 *  - `appendAudit` is best-effort and NEVER creates a directory (D-S8-06);
 *  - S2 (path shape `openrig-(workflow|run)-*`) is WARN only, never deny (D-S8-04);
 *  - the launch record validates exactly 8 fields (S6 W-19).
 *
 * S9 Wave B:
 *  - verb consumption is an atomic `O_EXCL` claim in `entry/consumed/<verb>` (W-S8-10);
 *    a claim that cannot be taken or persisted DENIES, never fails open;
 *  - `dryRun: true` authorizes nothing even when the phase write was lost (W-S8-14).
 */
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, realpathSync, unlinkSync, writeFileSync, writeSync, } from "node:fs";
import { basename, isAbsolute, join, resolve } from "node:path";
import { tmpdir } from "node:os";
/** Sentinel file a fixture home drops to mark itself as fixture-scoped. */
export const FIXTURE_HOME_MARKER = ".openrig-fixture";
/** S1 marker relative to an OPENRIG_HOME. */
export const MANAGED_RUN_MARKER = join("entry", "managed-run.json");
/** Single-launch authorization relative to an OPENRIG_HOME. */
export const LAUNCH_RECORD_PATH = join("entry", "launch.json");
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
export const CONSUMED_LEDGER_DIR = join("entry", "consumed");
/** Human/audit mirror of the claims (append-only; never the gate). */
export const CONSUMED_LEDGER_LOG = join("entry", "consumed.jsonl");
/**
 * Every recognized lifecycle-entry verb. Classification may identify these verbs,
 * and a launch record may explicitly authorize them, but recognition is not
 * authorization: only DEFAULT_LAUNCH_VERBS is granted to a supervisor launch.
 */
export const ENTRY_VERBS = [
    "daemon-start",
    "up",
    "restore-apply",
    "workflow-instantiate",
    "workflow-instantiate-lifecycle",
    "workflow-run",
    "snapshot-create",
    "archive",
    "unarchive",
    "compact",
    "seat-launch",
    "seat-restart",
    "seat-stop",
    "seat-clean",
    "seat-handover",
    "seat-continue",
    "workflow-route",
    "workflow-resume",
    "workflow-abort",
    "workflow-revision",
    "workflow-project",
    "release",
    "attach",
    "add-member",
    "grow",
    "expand",
    "shrink",
    "remove-node",
    "launch-node",
    "create",
    "import-rig",
    "adopt",
    "fork",
    "bind",
    "bootstrap",
    "bundle-install",
    "reconcile-session",
    "unclaim",
    "seat-clear-attention",
    "seat-resume-token",
];
/**
 * The six startup verbs a supervisor launch authorizes exactly once.
 *
 * Single-consumption is intentional: a launch ticket authorizes one daemon boot,
 * one `up`, one restore, etc. Adding a recognized lifecycle verb must NOT silently
 * grant it to every launch; such a verb is denied until a launch record explicitly
 * includes it (or a documented escape hatch is used).
 */
export const STARTUP_LAUNCH_VERBS = [
    "daemon-start",
    "up",
    "restore-apply",
    "workflow-instantiate",
    "workflow-instantiate-lifecycle",
    "workflow-run",
];
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
export const CONTINUATION_VERBS = [
    "workflow-route",
    "workflow-resume",
    "workflow-abort",
    "workflow-revision",
    "workflow-project",
];
/**
 * The verbs an `openrig-run start` supervisor launch authorizes by default
 * (D-S8-05, extended by S10 r3 S1-2): the six single-use startup verbs plus the
 * repeatable workflow-continuation verbs. The list is deliberately independent of
 * ENTRY_VERBS: recognizing a lifecycle verb must not silently grant it here.
 */
export const DEFAULT_LAUNCH_VERBS = [
    ...STARTUP_LAUNCH_VERBS,
    ...CONTINUATION_VERBS,
];
/** True for the repeatable, launch-scoped workflow-continuation class. */
export function isContinuationVerb(verb) {
    return CONTINUATION_VERBS.includes(verb);
}
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
export const ACCEPTED_RISK_CLI_COMMANDS = ["down", "daemon stop", "destroy"];
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isEntryVerb(value) {
    return typeof value === "string" && ENTRY_VERBS.includes(value);
}
function isLaunchPhase(value) {
    return value === "starting" || value === "active" || value === "closed";
}
function safeRealpath(path) {
    try {
        return realpathSync(path);
    }
    catch {
        return resolve(path);
    }
}
/** Same-path comparison used by every layer (L0–L3) before a home match is accepted. */
export { safeRealpath };
/** Same semantics as `packages/cli/src/openrig-compat.ts:isFixtureScopedHome` (copied, not imported). */
export function isFixtureScopedHome(home) {
    if (!home)
        return false;
    if (existsSync(join(home, FIXTURE_HOME_MARKER)))
        return true;
    const tempRoots = [tmpdir(), "/tmp", "/private/tmp", "/var/folders"];
    const normalized = resolve(home);
    const underTemp = tempRoots.some((root) => {
        const prefix = root.endsWith("/") ? root : `${root}/`;
        return normalized === resolve(root) || normalized.startsWith(prefix);
    });
    return underTemp && /(^|\/)openrig-qa[^/]*/.test(normalized);
}
/**
 * Classify an OPENRIG_HOME. Order is significant: fixture > managed > run-shaped > other.
 * A marker whose JSON is corrupt still counts as `managed` (fail-closed).
 */
export function classifyHome(home) {
    if (!home)
        return "other";
    if (isFixtureScopedHome(home))
        return "fixture";
    if (existsSync(join(home, MANAGED_RUN_MARKER)))
        return "managed";
    if (/^openrig-(workflow|run)-/.test(basename(resolve(home))))
        return "run-shaped";
    return "other";
}
const VALUE_BEARING_GLOBAL_FLAGS = new Set(["-o", "--output", "--format"]);
// Value-bearing options for the lifecycle commands classified below. Unknown
// options are treated as boolean-shaped by walkTail() and therefore never swallow
// a positional; a value is skipped only when the option is known to consume one.
// This prevents a value such as `--plan` from being mistaken for the preview flag.
const DAEMON_START_VALUE_FLAGS = new Set([
    "--port",
    "--host",
    "--db",
    "--wait-for-kernel-ms",
]);
const UP_VALUE_FLAGS = new Set([
    "--cwd",
    "--env",
    "--target",
    "--preset",
    "--seat",
    "--fresh",
    "--host",
]);
const SNAPSHOT_VALUE_FLAGS = new Set(["--intended-seats"]);
const RESTORE_VALUE_FLAGS = new Set(["--rig"]);
const SEAT_VALUE_FLAGS = new Set([
    "--reason",
    "--operator",
    "--source",
    "--expect-account",
]);
const HANDOVER_VALUE_FLAGS = new Set(["--source", "--reason", "--operator"]);
// The union is used only to locate the real first positional (the workflow
// subcommand); individual subcommands then inspect the same walk result.
const WORKFLOW_VALUE_FLAGS = new Set([
    "--operation-key",
    "--root-objective",
    "--created-by",
    "--entry-owner",
    "--rig",
    "--project",
    "--mission",
    "--slice",
    "--tags",
    "--instance",
    "--current-packet",
    "--exit",
    "--actor-session",
    "--result-note",
    "--evidence-ref",
    "--evidence-digest",
    "--wait-for-proof",
    "--blocked-on",
    "--next-owner",
    "--acceptance-candidate",
    "--acceptance-verdict",
    "--acceptance-evidence-ref",
    "--status",
    "--packet",
    "--component",
    "--expected-version",
    "--expected-digest",
    "--reason",
    "--to",
    "--occurrence",
    "--decision",
]);
const ATTACH_VALUE_FLAGS = new Set([
    "--rig",
    "--node",
    "--pod",
    "--member",
    "--runtime",
    "--cwd",
    "--display-name",
]);
const ADD_MEMBER_VALUE_FLAGS = new Set(["--rig-root"]);
const GROW_VALUE_FLAGS = new Set(["--pod", "--new-pod", "--runtime", "--cwd"]);
const EXPAND_VALUE_FLAGS = new Set(["--rig-root"]);
const SHRINK_VALUE_FLAGS = new Set(["--fallback"]);
const REMOVE_VALUE_FLAGS = new Set(["--fallback"]);
const LAUNCH_VALUE_FLAGS = new Set([
    "--seats",
    "--hold-reason",
    "--snapshot-id",
    "--retry-startup-from",
    "--rig-root",
    "--host",
]);
const CREATE_VALUE_FLAGS = new Set(["--runtime", "--cwd"]);
const IMPORT_VALUE_FLAGS = new Set(["--target-rig", "--rig-root", "--cwd"]);
const ADOPT_VALUE_FLAGS = new Set(["--bind", "--bindings-file", "--target-rig", "--rig-root"]);
const FORK_VALUE_FLAGS = new Set([
    "--rig",
    "--pod",
    "--member",
    "--image-name",
    "--image-version",
    "--rig-root",
]);
const BIND_VALUE_FLAGS = new Set(["--rig", "--node", "--pod", "--member"]);
const BOOTSTRAP_VALUE_FLAGS = new Set(["--cwd", "--target"]);
// Union over bundle subcommands: only `install` is lifecycle, but the full set is
// needed to locate that subcommand and to keep help/version values from being
// mistaken for option-position requests.
const BUNDLE_VALUE_FLAGS = new Set([
    "-o",
    "--output",
    "--name",
    "--bundle-version",
    "--include-packages",
    "--rig-root",
    "--context-pack",
    "--project-dir",
    "--preset",
    "--seat",
    "--notes",
    "--min-daemon-version",
    "--min-cli-version",
    "--target",
    "--cwd",
    "--rig",
    "--since",
]);
const RECONCILE_SESSION_VALUE_FLAGS = new Set(["--rig", "--node"]);
const HELP_FLAGS = new Set(["--help", "-h"]);
const VERSION_FLAGS = new Set(["--version", "-V"]);
const NO_VALUE_FLAGS = new Set();
/** Value-bearing options for the selected top-level command only. Keeping these
 * command-scoped avoids cross-command collisions (for example `up --fresh <seats...>`
 * must not make seat launch's boolean `--fresh` consume the next token). */
function helpValueFlagsForCommand(command) {
    if (command === "daemon")
        return DAEMON_START_VALUE_FLAGS;
    if (command === "up")
        return UP_VALUE_FLAGS;
    if (command === "snapshot")
        return SNAPSHOT_VALUE_FLAGS;
    if (command === "restore")
        return RESTORE_VALUE_FLAGS;
    if (command === "seat")
        return SEAT_VALUE_FLAGS;
    if (command === "handover")
        return HANDOVER_VALUE_FLAGS;
    if (command === "workflow")
        return WORKFLOW_VALUE_FLAGS;
    if (command === "attach")
        return ATTACH_VALUE_FLAGS;
    if (command === "add")
        return ADD_MEMBER_VALUE_FLAGS;
    if (command === "grow")
        return GROW_VALUE_FLAGS;
    if (command === "expand")
        return EXPAND_VALUE_FLAGS;
    if (command === "shrink")
        return SHRINK_VALUE_FLAGS;
    if (command === "remove")
        return REMOVE_VALUE_FLAGS;
    if (command === "launch")
        return LAUNCH_VALUE_FLAGS;
    if (command === "create")
        return CREATE_VALUE_FLAGS;
    if (command === "import")
        return IMPORT_VALUE_FLAGS;
    if (command === "adopt")
        return ADOPT_VALUE_FLAGS;
    if (command === "fork")
        return FORK_VALUE_FLAGS;
    if (command === "bind")
        return BIND_VALUE_FLAGS;
    if (command === "bootstrap")
        return BOOTSTRAP_VALUE_FLAGS;
    if (command === "bundle")
        return BUNDLE_VALUE_FLAGS;
    if (command === "reconcile-session")
        return RECONCILE_SESSION_VALUE_FLAGS;
    return NO_VALUE_FLAGS;
}
/**
 * Commander-shaped walk over a command tail.
 *
 * - `--` ends option parsing; every later token remains a positional/subcommand
 *   candidate and can never become a flag or consume an option value.
 * - a known value-bearing option consumes the next token, even when that token
 *   starts with `-` (Commander does the same for `--reason --plan`).
 * - `--opt=value` never consumes the next token.
 * - `positionals[0]` is the first real positional/subcommand.
 */
function walkTail(argv, from, valueFlags, optionsAlreadyEnded = false) {
    const positionals = [];
    const flags = new Set();
    let optionsEnded = optionsAlreadyEnded;
    for (let i = from; i < argv.length; i++) {
        const token = argv[i];
        if (optionsEnded) {
            positionals.push(token);
            continue;
        }
        if (token === "--") {
            optionsEnded = true;
            continue;
        }
        if (token.startsWith("--")) {
            const equals = token.indexOf("=");
            const name = equals >= 0 ? token.slice(0, equals) : token;
            flags.add(name);
            if (equals < 0 && valueFlags.has(name)) {
                const value = argv[i + 1];
                if (value !== undefined && value !== "--")
                    i += 1;
            }
            continue;
        }
        if (token.startsWith("-") && token !== "-") {
            flags.add(token);
            if (valueFlags.has(token)) {
                const value = argv[i + 1];
                if (value !== undefined && value !== "--")
                    i += 1;
            }
            continue;
        }
        positionals.push(token);
    }
    return { positionals, flags };
}
function hasAnyFlag(flags, candidates) {
    for (const candidate of candidates) {
        if (flags.has(candidate))
            return true;
    }
    return false;
}
/**
 * Commander's version option is global: `--version` / `-V` display the version
 * and exit before an action even when a value-bearing option expected that token
 * as its value. A `--` before it makes it positional data instead.
 */
function hasGlobalVersionRequest(argv) {
    for (const token of argv) {
        if (token === "--")
            return false;
        if (VERSION_FLAGS.has(token))
            return true;
    }
    return false;
}
/** Root-level --help/-h before the first command token, respecting value options. */
function hasRootHelpRequest(argv) {
    for (let i = 0; i < argv.length; i++) {
        const token = argv[i];
        if (token === "--")
            return false;
        if (HELP_FLAGS.has(token))
            return true;
        if (VALUE_BEARING_GLOBAL_FLAGS.has(token)) {
            const value = argv[i + 1];
            if (value !== undefined && value !== "--")
                i += 1;
            continue;
        }
        if (token.startsWith("-") && token !== "-")
            continue;
        return false;
    }
    return false;
}
/**
 * Locate the root command token, skipping leading global flags and their values.
 * A root `--` ends option parsing but does NOT discard the command that follows it;
 * it also makes every later token positional data, matching Commander.
 */
function locateCommand(argv) {
    let optionsEnded = false;
    for (let i = 0; i < argv.length; i++) {
        const token = argv[i];
        if (optionsEnded)
            return { index: i, rootOptionsEnded: true };
        if (token === "--") {
            optionsEnded = true;
            continue;
        }
        if (VALUE_BEARING_GLOBAL_FLAGS.has(token)) {
            const value = argv[i + 1];
            if (value !== undefined && value !== "--")
                i += 1;
            continue;
        }
        if (token.startsWith("-") && token !== "-")
            continue;
        return { index: i, rootOptionsEnded: false };
    }
    return { index: -1, rootOptionsEnded: false };
}
/**
 * Step 0 — pure argv classification. `argv` is the command tail (no node/script).
 * Returns `not_entry` for anything not in the recognized lifecycle table.
 * `--` ends option/flag parsing, but the tokens after it still participate in
 * command/subcommand and positional discovery, matching Commander.
 */
export function classifyEntryVerb(argv) {
    if (hasGlobalVersionRequest(argv))
        return { mode: "not_entry", verb: null };
    if (hasRootHelpRequest(argv))
        return { mode: "not_entry", verb: null };
    const location = locateCommand(argv);
    const index = location.index;
    if (index < 0)
        return { mode: "not_entry", verb: null };
    const command = argv[index];
    const rootOptionsEnded = location.rootOptionsEnded;
    // Command-level help/version is pure display, never a lifecycle mutation.
    // The command-scoped value flags keep `--reason --help` a value, not a help
    // request. A root-level `--` makes the remaining argv positional, so no scan.
    const helpScan = walkTail(argv, index + 1, rootOptionsEnded ? NO_VALUE_FLAGS : helpValueFlagsForCommand(command), rootOptionsEnded);
    if (hasAnyFlag(helpScan.flags, HELP_FLAGS)) {
        return { mode: "not_entry", verb: null };
    }
    if (command === "daemon") {
        const tail = walkTail(argv, index + 1, DAEMON_START_VALUE_FLAGS, rootOptionsEnded);
        if (tail.positionals[0] === "start")
            return { mode: "entry", verb: "daemon-start" };
        return { mode: "not_entry", verb: null };
    }
    if (command === "up") {
        const tail = walkTail(argv, index + 1, UP_VALUE_FLAGS, rootOptionsEnded);
        if (tail.flags.has("--existing"))
            return { mode: "recovery", verb: null };
        if (tail.flags.has("--host"))
            return { mode: "remote", verb: null };
        return { mode: "entry", verb: "up" };
    }
    if (command === "snapshot") {
        const tail = walkTail(argv, index + 1, SNAPSHOT_VALUE_FLAGS, rootOptionsEnded);
        const first = tail.positionals[0];
        if (first === undefined || first === "list")
            return { mode: "not_entry", verb: null };
        return { mode: "entry", verb: "snapshot-create" };
    }
    if (command === "restore") {
        const tail = walkTail(argv, index + 1, RESTORE_VALUE_FLAGS, rootOptionsEnded);
        const first = tail.positionals[0];
        if (first !== undefined && first !== "status") {
            return { mode: "entry", verb: "restore-apply" };
        }
        return { mode: "not_entry", verb: null };
    }
    if (command === "archive")
        return { mode: "entry", verb: "archive" };
    if (command === "unarchive")
        return { mode: "entry", verb: "unarchive" };
    if (command === "release")
        return { mode: "entry", verb: "release" };
    if (command === "attach")
        return { mode: "entry", verb: "attach" };
    if (command === "add")
        return { mode: "entry", verb: "add-member" };
    if (command === "grow")
        return { mode: "entry", verb: "grow" };
    if (command === "expand")
        return { mode: "entry", verb: "expand" };
    if (command === "shrink")
        return { mode: "entry", verb: "shrink" };
    if (command === "remove")
        return { mode: "entry", verb: "remove-node" };
    if (command === "create")
        return { mode: "entry", verb: "create" };
    if (command === "adopt")
        return { mode: "entry", verb: "adopt" };
    if (command === "fork")
        return { mode: "entry", verb: "fork" };
    if (command === "bind")
        return { mode: "entry", verb: "bind" };
    if (command === "reconcile-session")
        return { mode: "entry", verb: "reconcile-session" };
    if (command === "unclaim")
        return { mode: "entry", verb: "unclaim" };
    if (command === "launch") {
        const tail = walkTail(argv, index + 1, LAUNCH_VALUE_FLAGS, rootOptionsEnded);
        if (tail.flags.has("--plan"))
            return { mode: "not_entry", verb: null };
        return { mode: "entry", verb: "launch-node" };
    }
    if (command === "import") {
        const tail = walkTail(argv, index + 1, IMPORT_VALUE_FLAGS, rootOptionsEnded);
        // S10 r3 S2-9 — `--workspace-only` calls POST /api/rigs/import/workspace,
        // which writes the target rig's workspace declaration via setRigWorkspace.
        // It is a lifecycle mutation even though it does not instantiate topology.
        // Only `--preflight` (and the no-flag validate-only default) are read-only.
        if (tail.flags.has("--workspace-only")) {
            return { mode: "entry", verb: "import-rig" };
        }
        if (tail.flags.has("--preflight")) {
            return { mode: "not_entry", verb: null };
        }
        if (tail.flags.has("--instantiate") || tail.flags.has("--materialize-only")) {
            return { mode: "entry", verb: "import-rig" };
        }
        return { mode: "not_entry", verb: null };
    }
    if (command === "bootstrap") {
        const tail = walkTail(argv, index + 1, BOOTSTRAP_VALUE_FLAGS, rootOptionsEnded);
        if (tail.flags.has("--plan"))
            return { mode: "not_entry", verb: null };
        return { mode: "entry", verb: "bootstrap" };
    }
    if (command === "bundle") {
        const tail = walkTail(argv, index + 1, BUNDLE_VALUE_FLAGS, rootOptionsEnded);
        if (tail.positionals[0] === "install") {
            if (tail.flags.has("--plan"))
                return { mode: "not_entry", verb: null };
            return { mode: "entry", verb: "bundle-install" };
        }
        return { mode: "not_entry", verb: null };
    }
    if (command === "compact") {
        const tail = walkTail(argv, index + 1, NO_VALUE_FLAGS, rootOptionsEnded);
        if (tail.flags.has("--state"))
            return { mode: "not_entry", verb: null };
        return { mode: "entry", verb: "compact" };
    }
    if (command === "handover") {
        const tail = walkTail(argv, index + 1, HANDOVER_VALUE_FLAGS, rootOptionsEnded);
        if (tail.flags.has("--dry-run"))
            return { mode: "not_entry", verb: null };
        return { mode: "entry", verb: "seat-handover" };
    }
    // Other seat metadata/retention commands (set-*, switch-client,
    // retire-held-message, set-typing-guard) remain not_entry: they are not run
    // lifecycle transitions covered by this L0 gate.
    if (command === "seat") {
        const tail = walkTail(argv, index + 1, SEAT_VALUE_FLAGS, rootOptionsEnded);
        const subcommand = tail.positionals[0];
        if (subcommand === "launch") {
            if (tail.flags.has("--plan"))
                return { mode: "not_entry", verb: null };
            return { mode: "entry", verb: "seat-launch" };
        }
        if (subcommand === "restart") {
            if (tail.flags.has("--plan") || tail.flags.has("--verify")) {
                return { mode: "not_entry", verb: null };
            }
            return { mode: "entry", verb: "seat-restart" };
        }
        if (subcommand === "stop")
            return { mode: "entry", verb: "seat-stop" };
        if (subcommand === "clean")
            return { mode: "entry", verb: "seat-clean" };
        if (subcommand === "continue")
            return { mode: "entry", verb: "seat-continue" };
        if (subcommand === "clear-attention") {
            return { mode: "entry", verb: "seat-clear-attention" };
        }
        if (subcommand === "set-resume-token") {
            return { mode: "entry", verb: "seat-resume-token" };
        }
        if (subcommand === "handover") {
            if (tail.flags.has("--dry-run"))
                return { mode: "not_entry", verb: null };
            return { mode: "entry", verb: "seat-handover" };
        }
        return { mode: "not_entry", verb: null };
    }
    if (command === "workflow") {
        const tail = walkTail(argv, index + 1, WORKFLOW_VALUE_FLAGS, rootOptionsEnded);
        const verb = tail.positionals[0];
        if (verb === "instantiate")
            return { mode: "entry", verb: "workflow-instantiate" };
        if (verb === "instantiate-lifecycle") {
            return { mode: "entry", verb: "workflow-instantiate-lifecycle" };
        }
        if (verb === "run")
            return { mode: "entry", verb: "workflow-run" };
        if (verb === "route")
            return { mode: "entry", verb: "workflow-route" };
        if (verb === "resume")
            return { mode: "entry", verb: "workflow-resume" };
        if (verb === "abort")
            return { mode: "entry", verb: "workflow-abort" };
        if (verb === "project")
            return { mode: "entry", verb: "workflow-project" };
        if (verb === "revise") {
            if (tail.flags.has("--apply"))
                return { mode: "entry", verb: "workflow-revision" };
        }
        return { mode: "not_entry", verb: null };
    }
    return { mode: "not_entry", verb: null };
}
/**
 * Read and validate `entry/launch.json`. Exactly 8 fields participate (S6 W-19):
 * schemaVersion, launchId, home, runId, phase, expiresAt, verbs, consumed.
 */
export function readLaunchRecord(home) {
    const path = join(home, LAUNCH_RECORD_PATH);
    let raw;
    try {
        raw = readFileSync(path, "utf8");
    }
    catch {
        return {
            ok: false,
            code: "entry_guard_denied",
            reason: `no valid launch record at ${path}`,
        };
    }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        return {
            ok: false,
            code: "entry_guard_denied",
            reason: `launch record is not valid JSON at ${path}`,
        };
    }
    if (!isRecord(parsed)) {
        return { ok: false, code: "entry_guard_denied", reason: "launch record is not an object" };
    }
    if (parsed["schemaVersion"] !== 1) {
        return {
            ok: false,
            code: "entry_guard_schema_unsupported",
            reason: `launch record schemaVersion ${String(parsed["schemaVersion"])} is not supported`,
        };
    }
    const launchId = parsed["launchId"];
    const recordHome = parsed["home"];
    const runId = parsed["runId"];
    const phase = parsed["phase"];
    const expiresAt = parsed["expiresAt"];
    const verbs = parsed["verbs"];
    const consumed = parsed["consumed"];
    const invalid = (why) => ({
        ok: false,
        code: "entry_guard_denied",
        reason: `launch record invalid: ${why}`,
    });
    if (typeof launchId !== "string" || launchId.length === 0)
        return invalid("launchId");
    if (typeof recordHome !== "string" || !isAbsolute(recordHome))
        return invalid("home");
    // `runId` completeness is checked AFTER the authorization predicates (home/expiry/
    // token) in checkEntry/checkDaemonBoot. The frozen S8 SEED-02/03 records omit it but
    // must still report entry_guard_token_mismatch / entry_guard_expired; a record that
    // would otherwise be allowed is denied for the missing field.
    const normalizedRunId = typeof runId === "string" ? runId : "";
    if (!isLaunchPhase(phase))
        return invalid("phase");
    if (typeof expiresAt !== "string" || Number.isNaN(Date.parse(expiresAt))) {
        return invalid("expiresAt");
    }
    if (!Array.isArray(verbs) || !verbs.every(isEntryVerb))
        return invalid("verbs");
    if (!Array.isArray(consumed))
        return invalid("consumed");
    const consumedVerbs = [];
    for (const item of consumed) {
        if (!isRecord(item) || !isEntryVerb(item["verb"]) || typeof item["at"] !== "string") {
            return invalid("consumed[]");
        }
        consumedVerbs.push({
            verb: item["verb"],
            at: item["at"],
            pid: typeof item["pid"] === "number" ? item["pid"] : 0,
        });
    }
    return {
        ok: true,
        record: {
            ...parsed,
            schemaVersion: 1,
            launchId,
            home: recordHome,
            runId: normalizedRunId,
            phase,
            expiresAt,
            verbs: [...verbs],
            consumed: consumedVerbs,
        },
    };
}
function describeError(error) {
    return error instanceof Error ? error.message : String(error);
}
function isErrnoCode(error, code) {
    return (typeof error === "object" &&
        error !== null &&
        error.code === code);
}
/**
 * A launch-scoped directory name that cannot escape the home. `launch-<uuid>` is
 * unchanged; anything exotic is folded to `_` and would then only ever produce a
 * fail-closed collision, never a traversal.
 */
export function ledgerScope(launchId) {
    const folded = launchId.replace(/[^A-Za-z0-9._-]/g, "_");
    if (folded === "" || folded === "." || folded === "..")
        return "_invalid-launch-id";
    return folded.slice(0, 128);
}
/** Where one launch's claim for `verb` lives. */
export function ledgerClaimPath(home, launchId, verb) {
    return join(home, CONSUMED_LEDGER_DIR, ledgerScope(launchId), verb);
}
/**
 * Verbs already claimed BY THIS LAUNCH. A read error yields an empty set on purpose:
 * the atomic claim — not this read — is the gate, and a claim attempt still fails
 * closed.
 */
export function readConsumedLedger(home, launchId) {
    const verbs = new Set();
    let entries;
    try {
        entries = readdirSync(join(home, CONSUMED_LEDGER_DIR, ledgerScope(launchId)));
    }
    catch {
        return verbs;
    }
    for (const name of entries) {
        if (ENTRY_VERBS.includes(name))
            verbs.add(name);
    }
    return verbs;
}
/**
 * Atomically claim `verb` for one launch. Any failure returns `ok: false`.
 *
 * The O_EXCL file is the race gate. Both the claim file content and the human/audit
 * ledger line are written before the claim becomes final; if either write fails the
 * provisional claim file is removed. The ledger line is a mirror, never the gate, so
 * a released claim leaves the token available even if an append was partially written.
 */
export function claimVerb(input) {
    const dir = join(input.home, CONSUMED_LEDGER_DIR, ledgerScope(input.launchId));
    const writeFailed = (reason) => ({
        ok: false,
        code: "entry_guard_token_write_failed",
        reason,
    });
    try {
        mkdirSync(dir, { recursive: true });
    }
    catch (error) {
        return writeFailed(`cannot create the verb-claim ledger ${dir}: ${describeError(error)}`);
    }
    const path = join(dir, input.verb);
    const claim = {
        verb: input.verb,
        launchId: input.launchId,
        at: input.at ?? new Date().toISOString(),
        pid: input.pid ?? process.pid,
    };
    let fd;
    try {
        fd = openSync(path, "wx", 0o600);
    }
    catch (error) {
        if (isErrnoCode(error, "EEXIST")) {
            return {
                ok: false,
                code: "entry_guard_verb_consumed",
                reason: `verb '${input.verb}' was already consumed`,
                tokenSpent: true,
            };
        }
        return writeFailed(`cannot claim verb '${input.verb}' at ${path}: ${describeError(error)}`);
    }
    const closeQuietly = () => {
        try {
            closeSync(fd);
        }
        catch {
            // Closing never decides the token; a failure here is already covered by the
            // claim file's existence or removal below.
        }
    };
    /**
     * Release a provisional claim after a post-create failure. Returning the deny only
     * after the unlink gives the "a deny does not spend the token" property; if the
     * unlink itself fails, report `tokenSpent` explicitly instead of hiding it.
     */
    const failAndRelease = (reason) => {
        try {
            unlinkSync(path);
            return writeFailed(`${reason}; the provisional claim was released, so the verb was not consumed`);
        }
        catch (error) {
            if (isErrnoCode(error, "ENOENT")) {
                return writeFailed(`${reason}; the provisional claim was already absent, so the verb was not consumed`);
            }
            return {
                ...writeFailed(`${reason}; the provisional claim could NOT be released (${describeError(error)}) and the verb is spent`),
                tokenSpent: true,
            };
        }
    };
    try {
        writeSync(fd, `${JSON.stringify(claim)}\n`);
    }
    catch (error) {
        closeQuietly();
        return failAndRelease(`claim for '${input.verb}' could not be persisted at ${path}: ${describeError(error)}`);
    }
    closeQuietly();
    try {
        appendFileSync(join(input.home, CONSUMED_LEDGER_LOG), `${JSON.stringify(claim)}\n`);
    }
    catch (error) {
        return failAndRelease(`claim for '${input.verb}' was taken but its ledger line could not be appended: ${describeError(error)}`);
    }
    return { ok: true };
}
/** First 8 argv tokens, with `--env` values redacted. */
export function redactArgv(argv) {
    const head = argv.slice(0, 8);
    const out = [];
    for (let i = 0; i < head.length; i++) {
        const token = head[i];
        if (token === "--env") {
            out.push(token, "<redacted>");
            i += 1;
            continue;
        }
        if (token.startsWith("--env=")) {
            out.push("--env=<redacted>");
            continue;
        }
        out.push(token);
    }
    return out;
}
/**
 * Append one audit line. BEST-EFFORT and never creates a directory: if `home/entry`
 * does not exist the line is skipped, so a deny can still claim zero mutation (D-S8-06).
 */
export function appendAudit(home, entry) {
    try {
        const dir = join(home, "entry");
        if (!existsSync(dir))
            return;
        const record = {
            ts: entry.ts ?? new Date().toISOString(),
            decision: entry.decision,
            code: entry.code,
            verb: entry.verb,
            argv: entry.argv,
            runId: entry.runId,
            launchId: entry.launchId,
            home: entry.home,
            uid: entry.uid ?? process.getuid?.() ?? "unknown",
            pid: entry.pid ?? process.pid,
        };
        appendFileSync(join(dir, "audit.jsonl"), `${JSON.stringify(record)}\n`);
    }
    catch (error) {
        console.warn(`entry guard: audit append skipped (${error instanceof Error ? error.message : String(error)})`);
    }
}
function decision(partial) {
    return {
        allow: partial.allow,
        code: partial.code ?? null,
        reason: partial.reason,
        verb: partial.verb,
        mode: partial.mode,
        homeKind: partial.homeKind,
        warn: partial.warn ?? false,
        launchId: partial.launchId ?? null,
    };
}
function recordVerb(record, verb) {
    if (record.consumed.some((c) => c.verb === verb))
        return;
    record.consumed.push({ verb, at: new Date().toISOString(), pid: process.pid });
    // A rewrite, not an append: `consumed` is a JSON array inside launch.json.
    const path = join(record.home, LAUNCH_RECORD_PATH);
    try {
        writeFileSync(path, `${JSON.stringify(record, null, 2)}\n`);
    }
    catch (error) {
        console.warn(`entry guard: verb consumption not persisted (${error instanceof Error ? error.message : String(error)})`);
    }
}
/**
 * Step 0–14. Read-only except for the explicit audit append and (on allow at step 14b)
 * the single-use verb claim. A deny may create a provisional claim while racing, but
 * claimVerb releases it before returning a deny unless the kernel refuses the unlink
 * (then the deny explicitly reports that the token is spent).
 */
export function checkEntry(input) {
    const env = input.env;
    const now = input.now ?? new Date();
    const argv = input.argv;
    const cls = classifyEntryVerb(argv);
    // Step 0/1 — not an entry verb: zero disk reads.
    if (cls.mode === "not_entry") {
        return decision({
            allow: true,
            reason: "not an entry verb",
            verb: null,
            mode: cls.mode,
            homeKind: "other",
        });
    }
    // Step 2 — explicit global off switch: no reads, no audit.
    if (env["OPENRIG_ENTRY_GUARD"] === "off") {
        return decision({
            allow: true,
            reason: "entry guard disabled by OPENRIG_ENTRY_GUARD=off",
            verb: cls.verb,
            mode: cls.mode,
            homeKind: "other",
        });
    }
    const homeKind = classifyHome(input.home);
    const auditBase = {
        code: null,
        verb: cls.verb,
        argv: redactArgv(argv),
        runId: env["OPENRIG_ENTRY_RUN_ID"] ?? null,
        launchId: env["OPENRIG_ENTRY_LAUNCH_ID"] ?? null,
        home: input.home,
        pid: input.pid,
    };
    // Step 3 — remote `up`: cannot judge a remote home, WARN once and pass.
    if (cls.mode === "remote") {
        appendAudit(input.home, { ...auditBase, decision: "warn" });
        return decision({
            allow: true,
            reason: "remote up: local entry guard cannot judge a remote host",
            verb: null,
            mode: cls.mode,
            homeKind,
            warn: true,
        });
    }
    // Step 4 — recovery `up --existing`: pass, audit if the home is already an entry home,
    // and do not read the marker/record or consume a verb.
    if (cls.mode === "recovery") {
        if (existsSync(join(input.home, "entry"))) {
            appendAudit(input.home, { ...auditBase, decision: "allow_recovery" });
        }
        return decision({
            allow: true,
            reason: "recovery up --existing",
            verb: null,
            mode: cls.mode,
            homeKind,
        });
    }
    // Step 5 — escape hatch: env or the stripped `--allow-direct` flag.
    if (env["OPENRIG_ALLOW_DIRECT"] === "1" || input.allowDirect === true) {
        appendAudit(input.home, { ...auditBase, decision: "allow_override" });
        return decision({
            allow: true,
            reason: input.allowDirect === true
                ? `explicit --allow-direct${input.allowDirectReason ? ` (${input.allowDirectReason})` : ""}`
                : "OPENRIG_ALLOW_DIRECT=1",
            verb: cls.verb,
            mode: cls.mode,
            homeKind,
        });
    }
    // Step 6 — fixture home: always pass.
    if (homeKind === "fixture") {
        return decision({
            allow: true,
            reason: "fixture-scoped home",
            verb: cls.verb,
            mode: cls.mode,
            homeKind,
        });
    }
    // Step 7 — not a run context.
    if (homeKind === "other") {
        return decision({
            allow: true,
            reason: "not a managed run home",
            verb: cls.verb,
            mode: cls.mode,
            homeKind,
        });
    }
    // Step 8 — S2 path shape only: WARN, never deny (D-S8-04).
    if (homeKind === "run-shaped") {
        appendAudit(input.home, { ...auditBase, decision: "warn" });
        return decision({
            allow: true,
            reason: "run-shaped home without a managed-run marker (S2 warn)",
            verb: cls.verb,
            mode: cls.mode,
            homeKind,
            warn: true,
        });
    }
    // Step 9 — managed home: the launch record must exist and be readable.
    const read = readLaunchRecord(input.home);
    if (!read.ok || !read.record) {
        const code = read.code ?? "entry_guard_denied";
        const reason = read.reason ?? "no valid launch record";
        appendAudit(input.home, { ...auditBase, code, decision: "deny" });
        return decision({
            allow: false,
            code,
            reason,
            verb: cls.verb,
            mode: cls.mode,
            homeKind,
        });
    }
    const record = read.record;
    const deny = (code, reason) => {
        appendAudit(input.home, { ...auditBase, code, decision: "deny", launchId: record.launchId });
        return decision({
            allow: false,
            code,
            reason,
            verb: cls.verb,
            mode: cls.mode,
            homeKind,
            launchId: record.launchId,
        });
    };
    // Step 10 — the record must belong to THIS home.
    if (safeRealpath(record.home) !== safeRealpath(input.home)) {
        return deny("entry_guard_home_mismatch", `launch record home ${record.home} != ${input.home}`);
    }
    // Step 11 — TTL.
    if (now.getTime() > Date.parse(record.expiresAt)) {
        return deny("entry_guard_expired", `launch record expired at ${record.expiresAt}`);
    }
    // Step 12 — closed launches authorize nothing, and neither does a dry-run record
    // (S9 W-S8-14: a dry run must never leave a live authorization behind, even if a
    // crash prevented the writer from flipping phase to `closed`).
    if (record.phase === "closed") {
        return deny("entry_guard_closed", "launch record phase is closed");
    }
    if (record.dryRun === true) {
        return deny("entry_guard_closed", "launch record was a dry run (dryRun: true)");
    }
    // Step 13 — the env token is the authorization pointer.
    const token = env["OPENRIG_ENTRY_LAUNCH_ID"];
    if (token !== record.launchId) {
        return deny("entry_guard_token_mismatch", `OPENRIG_ENTRY_LAUNCH_ID does not match launchId ${record.launchId}`);
    }
    // Step 13b — record completeness required for an allow (see readLaunchRecord note).
    if (!record.runId) {
        return deny("entry_guard_denied", "launch record invalid: runId");
    }
    // Step 14a — the verb must be authorized by this launch. Startup verbs are
    // single-use; workflow-continuation verbs are repeatable for the lifetime of the
    // same launch record (S10 r3 S1-2) but still pass every predicate above.
    const verb = cls.verb;
    if (!verb) {
        return deny("entry_guard_verb_consumed", "entry mode without a verb");
    }
    if (!record.verbs.includes(verb)) {
        return deny("entry_guard_verb_consumed", `verb '${verb}' is not authorized by this launch`);
    }
    const repeatable = isContinuationVerb(verb);
    const alreadyConsumed = new Set(input.alreadyConsumed ?? []);
    if (!repeatable) {
        const consumedOnDisk = record.consumed.some((c) => c.verb === verb) ||
            readConsumedLedger(input.home, record.launchId).has(verb);
        if (consumedOnDisk && !alreadyConsumed.has(verb)) {
            return deny("entry_guard_verb_consumed", `verb '${verb}' was already consumed`);
        }
    }
    // Step 14b — atomically CLAIM the (single-use) verb before allowing. The exclusive
    // create is the decision point: a lost race, an unwritable ledger, or a failed claim
    // write all deny. Continuation verbs deliberately do not claim: a managed workflow
    // needs to project/route/resume/abort/revise more than once per launch.
    if (!repeatable && !alreadyConsumed.has(verb)) {
        const claim = claimVerb({
            home: input.home,
            verb,
            launchId: record.launchId,
            ...(input.pid !== undefined ? { pid: input.pid } : {}),
        });
        if (!claim.ok) {
            return deny(claim.code ?? "entry_guard_token_write_failed", claim.reason ?? `verb '${verb}' could not be claimed`);
        }
    }
    // The record's `consumed[]` stays the human/audit mirror for single-use startup
    // verbs; the ledger above is the authority. Repeatable continuation verbs are not
    // recorded as consumed, so a later step in the same launch can run them again.
    if (!repeatable)
        recordVerb(record, verb);
    appendAudit(input.home, { ...auditBase, decision: "allow_entry", launchId: record.launchId });
    return decision({
        allow: true,
        reason: `entry allowed for verb '${verb}'`,
        verb,
        mode: cls.mode,
        homeKind,
        launchId: record.launchId,
    });
}
/**
 * L2 daemon boot self-check. Only managed (S1) homes are judged; S2 stays a pass with
 * no marker (D-S8-04). The check validates the record but NEVER consumes a verb, because
 * the daemon boot is not an entry verb — it is proof that a valid launch is still live.
 */
export function checkDaemonBoot(input) {
    const env = input.env;
    const homeKind = classifyHome(input.home);
    if (homeKind !== "managed") {
        return decision({
            allow: true,
            reason: "not a managed run home",
            verb: null,
            mode: "not_entry",
            homeKind,
        });
    }
    if (env["OPENRIG_ENTRY_GUARD"] === "off" || env["OPENRIG_ALLOW_DIRECT"] === "1") {
        appendAudit(input.home, {
            code: null,
            verb: null,
            argv: [],
            runId: env["OPENRIG_ENTRY_RUN_ID"] ?? null,
            launchId: env["OPENRIG_ENTRY_LAUNCH_ID"] ?? null,
            home: input.home,
            pid: input.pid,
            decision: "allow_override",
        });
        return decision({
            allow: true,
            reason: env["OPENRIG_ENTRY_GUARD"] === "off"
                ? "entry guard disabled by OPENRIG_ENTRY_GUARD=off"
                : "OPENRIG_ALLOW_DIRECT=1",
            verb: null,
            mode: "entry",
            homeKind,
        });
    }
    const denyBoot = (reason) => {
        appendAudit(input.home, {
            code: "entry_guard_boot_denied",
            verb: null,
            argv: [],
            runId: env["OPENRIG_ENTRY_RUN_ID"] ?? null,
            launchId: env["OPENRIG_ENTRY_LAUNCH_ID"] ?? null,
            home: input.home,
            pid: input.pid,
            decision: "deny",
        });
        return decision({
            allow: false,
            code: "entry_guard_boot_denied",
            reason,
            verb: null,
            mode: "entry",
            homeKind,
        });
    };
    const read = readLaunchRecord(input.home);
    if (!read.ok || !read.record) {
        return denyBoot(read.reason ?? "no valid launch record");
    }
    const record = read.record;
    if (safeRealpath(record.home) !== safeRealpath(input.home)) {
        return denyBoot(`launch record home ${record.home} != ${input.home}`);
    }
    const now = input.now ?? new Date();
    if (now.getTime() > Date.parse(record.expiresAt)) {
        return denyBoot(`launch record expired at ${record.expiresAt}`);
    }
    if (record.phase === "closed")
        return denyBoot("launch record phase is closed");
    if (record.dryRun === true) {
        return denyBoot("launch record was a dry run (dryRun: true)");
    }
    if (env["OPENRIG_ENTRY_LAUNCH_ID"] !== record.launchId) {
        return denyBoot(`OPENRIG_ENTRY_LAUNCH_ID does not match launchId ${record.launchId}`);
    }
    if (!record.runId)
        return denyBoot("launch record invalid: runId");
    appendAudit(input.home, {
        code: null,
        verb: null,
        argv: [],
        runId: record.runId,
        launchId: record.launchId,
        home: input.home,
        pid: input.pid,
        decision: "allow_entry",
    });
    return decision({
        allow: true,
        reason: "managed launch record valid at daemon boot",
        verb: null,
        mode: "entry",
        homeKind,
        launchId: record.launchId,
    });
}
//# sourceMappingURL=entry-guard.js.map