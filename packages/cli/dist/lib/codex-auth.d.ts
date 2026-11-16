export declare function validateProfileName(name: unknown): name is string;
export interface CodexAuthPaths {
    /** Codex state dir — CODEX_HOME or $HOME/.codex. */
    codexHome: string;
    /** Saved-profile dir (0700). */
    profileDir: string;
    /** Active auth file the Codex CLI reads (0600). */
    activeAuth: string;
    /** Product-native seat->profile metadata registry (0600). */
    registryPath: string;
}
/** Resolve the Codex paths from an env map (default process.env). CODEX_HOME wins; else $HOME/.codex. */
export declare function resolveCodexHome(env?: NodeJS.ProcessEnv): CodexAuthPaths;
/** fd-first copy of `source` onto `dest` (OPR.0.4.3.23 secret-boundary B1 hardening). Closes the
 *  check-then-use gap that a path-based copy leaves open: an earlier lstat guard, then a copy that
 *  re-resolves the SOURCE PATH, can be redirected by an inode swap in the window (a crash, or a
 *  concurrent legitimate rig on the same auth home) — reading the wrong inode, a torn file, or briefly
 *  leaving a wider-than-0600 temp (CERT FIO45-C). Path-based pre-checks cannot close that race, so the
 *  authoritative check moves onto the OPENED fd:
 *   (1) SOURCE: openSync with O_NOFOLLOW (a final-component symlink swap fails closed), then fstat ON
 *       THE FD and validate the opened inode (regular file, nlink === 1 — a hardlink shares an inode
 *       that may live outside the boundary), and — when the caller passes its earlier lstat — confirm
 *       dev/ino still match (the inode was not swapped in the window). Read bytes FROM the fd; the
 *       source path is never re-resolved after the open.
 *   (2) DEST: openSync the temp with O_CREAT|O_EXCL (fresh inode; never a pre-existing hardlink/symlink)
 *       at 0600 AT creation (removes the create-then-chmod window), fchmod on the fd to pin 0600
 *       regardless of umask, write the source bytes, fsync, then renameSync as the SOLE atomic publish
 *       (a crash BEFORE the rename leaves the prior dest byte-intact — a strength we preserve).
 *  The temp stays co-located in dest's dir so the rename never crosses devices. The transient byte
 *  buffer is the only time secret bytes touch JS memory; it is never printed and is scrubbed in
 *  `finally`. Caller must still have verified dest's parent containment and that dest is replaceable
 *  (the lstat pre-checks stay as cheap fail-fast; this fd validation is the authoritative layer).
 *  Exported for the fd-first / crash-safety leak-hunt tests. */
export declare function copyOntoFresh(source: string, dest: string, expectSrc?: {
    dev: number;
    ino: number;
}): boolean;
export interface CodexAuthDeps {
    /** Resolve the Codex login state using EXIT CODE ONLY — never the external command's stdout/stderr
     *  (any future codex version could print a token there). Default: spawn `codex login status` with
     *  stdio ignored and map the exit code. Injectable for hermetic tests. */
    loginStatus?: (codexHome: string) => "logged_in" | "not_logged_in" | "unavailable";
}
export interface AuthStatusResult {
    codexHome: string;
    codexHomePresent: boolean;
    profileDirPresent: boolean;
    activeAuthPresent: boolean;
    activeAuthMode: string | null;
    activeAuthModeSafe: boolean | "unknown";
    profileCount: number;
    loginStatus: "logged_in" | "not_logged_in" | "unavailable";
}
/** Report auth-file presence/mode/safety + profile count + login-state. NEVER reads token contents. */
export declare function authStatus(paths: CodexAuthPaths, deps?: CodexAuthDeps): AuthStatusResult;
export type AuthValidateResult = {
    ok: true;
    name: string;
    path: string;
    mode: string;
} | {
    ok: false;
    reason: "invalid_profile" | "missing_profile" | "unsafe_path" | "unsafe_permissions" | "malformed_json" | "parse_check_unavailable";
};
/** Validate a saved profile: name whitelist -> safe regular file -> 0600 -> JSON parseable. The
 *  parse is in-memory and the result is discarded; on failure we return a FIXED reason and never the
 *  JSON.parse error (its message can include a snippet of the file = a secret). */
export declare function authValidate(paths: CodexAuthPaths, name: string): AuthValidateResult;
export type AuthSaveResult = {
    ok: true;
    name: string;
    path: string;
    mode: string;
} | {
    ok: false;
    reason: "invalid_profile" | "not_configured" | "unsafe_path" | "io_error";
};
/** Snapshot the active auth file into a named profile (0600 file in the 0700 profile dir). Byte-copy
 *  via copyFileSync — contents never enter JS memory; result reports name/path/mode only. */
export declare function authSave(paths: CodexAuthPaths, name: string): AuthSaveResult;
export type AuthSwitchResult = {
    ok: true;
    name: string;
    activePath: string;
    mode: string;
    note: string;
} | {
    ok: false;
    reason: "invalid_profile" | "missing_profile" | "unsafe_path" | "unsafe_permissions" | "io_error";
};
/** Activate a saved profile (copy it onto the active auth at 0600). Refuses to widen perms over an
 *  existing unsafe active file. Byte-copy; no content echoed. */
export declare function authSwitch(paths: CodexAuthPaths, name: string): AuthSwitchResult;
/** List saved profile names (safe regular *.json files in the profile dir), sorted. No contents read.
 *  Refuses to list through a symlinked / out-of-tree profile dir (returns []), so a redirected parent
 *  never exposes file names from outside CODEX_HOME. */
export declare function authList(paths: CodexAuthPaths): string[];
/** Stated in command output + docs: a seat label is metadata, never proof of a live account. */
export declare const SEAT_REGISTRY_DISCLAIMER = "Seat labels are metadata only; they do NOT prove a running session is actually using that account/profile.";
export interface SeatRow {
    seat: string;
    rig: string;
    runtime: string;
    cwd: string;
    authProfile: string;
    updatedTs: string;
}
export interface SeatSetFields {
    seat: string;
    rig: string;
    runtime: string;
    cwd?: string;
    authProfile?: string;
}
export type SeatSetResult = {
    ok: true;
    seat: string;
    registryPath: string;
    mode: string;
    disclaimer: string;
} | {
    ok: false;
    reason: "invalid_seat" | "invalid_rig" | "invalid_runtime" | "invalid_cwd" | "invalid_profile" | "unsafe_path" | "io_error";
};
/** Atomic upsert of a seat metadata row (tmp + rename). Drops pre-existing malformed rows rather than
 *  re-emitting fabricated metadata. `now` is injectable for deterministic tests. */
export declare function authSeatSet(paths: CodexAuthPaths, fields: SeatSetFields, now?: () => string): SeatSetResult;
/** List well-formed seat rows (malformed rows skipped). */
export declare function authSeatsList(paths: CodexAuthPaths): SeatRow[];
export type SeatShowResult = {
    ok: true;
    row: SeatRow;
} | {
    ok: false;
    reason: "invalid_seat" | "missing_seat" | "unsafe_path";
};
export declare function authSeatShow(paths: CodexAuthPaths, seat: string): SeatShowResult;
export interface SeatsReport {
    registryPresent: boolean;
    registryMode: string | null;
    registryModeSafe: boolean | "unknown";
    total: number;
    known: number;
    unknown: number;
    malformed: number;
}
export declare function authSeatsReport(paths: CodexAuthPaths): SeatsReport;
//# sourceMappingURL=codex-auth.d.ts.map