export type CheckStatus = "ok" | "warn" | "fail";
export interface DoctorCheck {
    check: string;
    status: CheckStatus;
    message: string;
    fixHint?: string;
    evidence?: Record<string, unknown>;
}
export type WorkspaceRootSource = "env" | "file" | "default";
export interface CheckWorkspaceRootInput {
    workspaceRoot: string;
    source: WorkspaceRootSource;
}
/**
 * Check #1 — workspace root reachable.
 *
 * Verifies the resolved workspace root exists as a directory. The
 * `source` (env / file / default) is propagated into the fix-hint so
 * the operator gets the right remediation channel.
 */
export declare function checkWorkspaceRootReachable(opts: CheckWorkspaceRootInput): DoctorCheck;
export interface CheckMissionsFolderInput {
    workspaceRoot: string;
    /** Resolved `workspace.slicesRoot` per ConfigStore (defaults to
     *  `<workspaceRoot>/missions`). Operators who customized
     *  `workspace.slices_root` (env or config) point this elsewhere; the
     *  check honors the override so a deliberate custom layout doesn't
     *  spuriously fail. */
    slicesRoot: string;
}
/**
 * Check #2 — missions folder present.
 *
 * Verifies the resolved missions folder (per ConfigStore `workspace.
 * slicesRoot` — defaults to `<workspaceRoot>/missions`) exists as a
 * directory. Fail on absence or wrong-shape; this is the load-bearing
 * folder for Project UI projection.
 */
export declare function checkMissionsFolder(opts: CheckMissionsFolderInput): DoctorCheck;
/**
 * Canonical-decoded allowlist entry as the shipped file API sees it
 * (post `decodeAllowlist`): absolute path, realpath-canonicalized
 * when reachable. Relative paths are silently dropped by the canonical
 * decoder before they reach this shape — see check #3 for the
 * usable-vs-raw entry-count semantics.
 */
export interface AllowlistEntry {
    name: string;
    /** Canonical absolute path (post-decodeAllowlist + realpathSync
     *  fallback). Equivalent to the file API's `AllowlistRoot.canonicalPath`. */
    path: string;
}
export interface CheckFileAllowlistInput {
    workspaceRoot: string;
    /** Raw `files.allowlist` value resolved via ConfigStore
     *  (comma-separated `name:/abs/path` pairs, or empty string). */
    allowlistValue: string;
    allowlistSource: WorkspaceRootSource;
    /** Pre-decoded entries; if omitted the check decodes allowlistValue
     *  via the canonical `decodeAllowlist` from
     *  domain/files/path-safety.ts so the doctor reports exactly what
     *  the shipped file API at /api/files/* accepts. Pre-decoded
     *  entries MUST be in canonical form (absolute path); raw
     *  named-pair strings from SettingsStore should go through
     *  allowlistValue + the in-function decode, not parsedEntries. */
    parsedEntries?: AllowlistEntry[];
}
/**
 * Check #3 — file allowlist sane.
 *
 * IMPL-PRD §43 references `<workspace-root>/.openrig/file-allowlist`
 * as a file — the shipped surface (ConfigStore `files.allowlist` key,
 * env OPENRIG_FILES_ALLOWLIST, default `workspace:${workspaceRoot}`)
 * is a CONFIGSTORE STRING KEY holding comma-separated `name:/abs/path`
 * pairs. There is no per-workspace file. Check #3 verifies the
 * resolved value decodes to at least one USABLE entry (canonical,
 * absolute) covering the workspaceRoot — the same usable-root
 * semantics the shipped file API at /api/files/* enforces via
 * `decodeAllowlist` in domain/files/path-safety.ts:60-80 (silently
 * drops non-absolute paths at line 71).
 *
 * Decoding via the canonical decoder (not a local re-implementation)
 * guarantees the doctor's verdict matches the actual file-API
 * behavior — `workspace:.` or `workspace:relative-root` evaluates
 * to zero usable entries here, mirroring the file API's silent skip.
 */
export declare function checkFileAllowlist(opts: CheckFileAllowlistInput): DoctorCheck;
export interface CheckDaemonWorkspaceInput {
    /** workspace.root the daemon process resolves (server-side). */
    daemonResolvedRoot: string;
    /** workspace.root the doctor caller expects (CLI-side resolved,
     *  passed in the request body or matched against the --workspace
     *  flag). */
    expectedRoot: string;
}
/**
 * Check #4 — daemon points at this workspace.
 *
 * Reports divergence between the workspace.root the daemon resolved at
 * start-time vs the workspace.root the doctor caller expects. The
 * common cause is the daemon being started in a shell with a different
 * OPENRIG_WORKSPACE_ROOT than the operator's current shell.
 */
export declare function checkDaemonWorkspace(opts: CheckDaemonWorkspaceInput): DoctorCheck;
export interface CheckDaemonReloadInput {
    /** Path to the ConfigStore config file on disk. */
    configFilePath: string;
    /** Daemon process start time as a Date. Callers typically capture
     *  this once at daemon-startup (e.g.
     *  `new Date(Date.now() - process.uptime() * 1000)` at the doctor
     *  route handler) and pass it through. Compared to config-file
     *  mtime; mtime > startTime → stale daemon. */
    daemonStartTime: Date;
}
/**
 * Check #5 — daemon reload needed.
 *
 * Compares config-file mtime to the daemon's start-time. A newer
 * mtime means the operator edited config (via CLI / UI) after the
 * daemon started, and the daemon hasn't picked the change up yet.
 * Missing config file is not a fail — fresh installs without an
 * operator-written config use defaults entirely and never need a
 * reload.
 */
export declare function checkDaemonReload(opts: CheckDaemonReloadInput): DoctorCheck;
export interface CheckSliceDocsInput {
    /** Resolved missions folder root. The check walks each
     *  `<missionsRoot>/<mission>/slices/<slice>/` and verifies it has
     *  SPEC.md or a readable legacy node file. */
    missionsRoot: string;
}
/**
 * Check #6 — optional slice docs.
 *
 * Walks each mission's slices subdirectory and reports slices that
 * have neither SPEC.md nor a readable legacy node file.
 * Warn-only (empty slices are sometimes intentional staging per
 * IMPL-PRD §57-59). The walk is bounded to one mission + one slice
 * level; we don't recurse into slice subdirs.
 */
export declare function checkOptionalSliceDocs(opts: CheckSliceDocsInput): DoctorCheck;
/**
 * Check #8 — SDLC convention sections (OPR.0.4.4.23).
 *
 * Walks each mission's slices and reports work-node files missing any of the
 * convention sections (`## Intent` / `## Mini-requirements` /
 * `## Proof contract`). Warn-only (advisory /
 * fail-open — the deep per-slice audit is `rig scope audit`; this row is
 * the workspace-level pointer). Slices with no work-node file are check #6's
 * concern, not double-reported here.
 */
export declare function checkSdlcConventionSections(opts: CheckSliceDocsInput): DoctorCheck;
export interface CheckMissionNotesInput {
    missionsRoot: string;
}
/**
 * Check #7 — mission NOTES presence.
 *
 * Verifies each mission directory has current `NOTES.md` or readable legacy
 * `MISSION_NOTES.md`. Warn-only because legacy missions can predate both.
 */
export declare function checkMissionNotesPresence(opts: CheckMissionNotesInput): DoctorCheck;
export interface RunDoctorInput {
    /** Workspace root under check (caller's --workspace override or
     *  daemon-resolved default). */
    workspaceRoot: string;
    workspaceRootSource: WorkspaceRootSource;
    /** Resolved missions folder per ConfigStore workspace.slices_root,
     *  or `<workspaceRoot>/missions` when caller overrode --workspace. */
    slicesRoot: string;
    /** Raw files.allowlist value from SettingsStore (will be decoded
     *  via canonical decodeAllowlist). */
    allowlistValue: string;
    allowlistSource: WorkspaceRootSource;
    /** Daemon-resolved workspace.root (for check #4 comparison against
     *  the workspace under check). */
    daemonResolvedWorkspaceRoot: string;
    /** Daemon's ConfigStore configPath on disk (for check #5 staleness
     *  comparison). */
    configFilePath: string;
    /** Daemon process start time (for check #5). */
    daemonStartTime: Date;
}
export interface DoctorReport {
    /** Workspace under check (echoes input.workspaceRoot for clarity). */
    workspaceRoot: string;
    checks: DoctorCheck[];
    summary: {
        ok: number;
        warn: number;
        fail: number;
    };
    /** ISO timestamp of when the daemon ran the report. */
    daemonResolvedAt: string;
}
/**
 * Orchestrator — runs all 7 checks in fixed order and returns a
 * structured DoctorReport with aggregate counts. Pure function;
 * filesystem effects are bounded to the individual check helpers
 * (statSync / readdirSync / existsSync). Used by the daemon route
 * POST /api/workspace/doctor (FR-5c) and by the CLI's --json
 * formatter (FR-5d).
 */
export declare function runWorkspaceDoctor(input: RunDoctorInput): DoctorReport;
//# sourceMappingURL=workspace-doctor.d.ts.map