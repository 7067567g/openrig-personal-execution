/** The first daemon version whose launch-subset route honours `plan: true`. */
export declare const PLAN_MIN_DAEMON_VERSION = "0.5.9";
/** A packaged daemon's stamped version: /healthz has carried `semver` on stamped builds since 0.4.4. */
export declare const DAEMON_HEALTH_PATH = "/healthz";
/** For unstamped development runs. Packaged 0.5.9 to 0.6.5 answer "unknown" here, so it is the fallback only;
 *  a daemon before 0.4.1 answers 404 and is refused. */
export declare const DAEMON_VERSION_PATH = "/api/health-summary/version";
/**
 * The local fork line, cut from the 0.7.0 pre-line tree. Its daemon honours `plan: true` even though `0.1.x`
 * sorts below {@link PLAN_MIN_DAEMON_VERSION}; without this exception `rig launch --plan` refuses to send
 * against a daemon built from this tree (r15 §5.1, decision D-b). A version string cannot tell this line from
 * an early upstream 0.1.x daemon, so `--host` to such a daemon is the known trade-off; the durable fix is a
 * daemon capability in `/healthz` (r15 D-c). Read by `launch-plan-guard.test.ts`, which keeps the local
 * `package.json` version on this line so the next line reset cannot silently reintroduce the refusal.
 */
export declare const LOCAL_LINE_MAJOR_MINOR: readonly [number, number];
/**
 * Before sending a plan request: returns null when the daemon reports version 0.5.9 or later, otherwise the
 * message to print instead of sending. `read(path)` GETs a read-only daemon path and returns its JSON body, or
 * undefined when the read failed; the caller picks the transport (local client or `--host`). The stamped
 * `/healthz` semver is read first; the version route answers only for unstamped development runs.
 */
export declare function planSupportRefusal(read: (path: string) => Promise<unknown>): Promise<string | null>;
/** After a plan request: true only for an answer that says it changed nothing. */
export declare function isPlanAnswer(data: unknown): boolean;
/**
 * After a plan request whose answer isn't a plan: true when the answer shows the daemon acted, meaning a 2xx, or
 * a body reporting seats (an older daemon's 409 `attention_required` launch carries `launched`). A plan error from
 * a daemon that honours `plan` (unknown rig, unmatched seat, no usable snapshot) shows neither and keeps its own
 * error output.
 */
export declare function answerShowsAction(succeeded: boolean, data: unknown): boolean;
/** The warning for an answer that isn't a plan but shows the daemon acted. `-A` because `rig ps --nodes` refuses
 *  an implicit scope outside a managed session and over `--host`, and `--rig` takes a name where launch takes an id. */
export declare function notAPlanMessage(host?: string): string;
//# sourceMappingURL=launch-plan-guard.d.ts.map