import type Database from "better-sqlite3";
import type { RigRepository } from "./rig-repository.js";
import type { SessionRegistry } from "./session-registry.js";
import type { EventBus } from "./event-bus.js";
import type { TmuxAdapter } from "../adapters/tmux.js";
import type { TranscriptStore } from "./transcript-store.js";
import type { TmuxOptionDefaultsApplier } from "./tmux-option-defaults.js";
import type { OccupantKind } from "./session-registry.js";
import { type SeatEnv } from "./seat-env.js";
import type { LaunchAdmission, LaunchLane } from "./launch-admission.js";
import { type ProviderRateLimiter } from "./provider-rate-limit.js";
import type { Session, Binding } from "./types.js";
export type LaunchResult = {
    ok: true;
    sessionName: string;
    session: Session;
    binding: Binding;
    warnings?: string[];
} | {
    ok: false;
    code: string;
    message: string;
};
interface LaunchOpts {
    sessionName?: string;
    cwd?: string;
    /**
     * Per-seat silence window override (seconds). Currently inert: the
     * live SeatActivityService poller uses the global default (3s) and
     * does not read per-seat windows. Retained for future per-seat-poller
     * decision. Caller plumbs from AgentSpec.profile.activity.
     */
    silenceWindowSeconds?: number;
    /** A deliberate fresh occupant is distinct from initial rig boot in the tenure ledger. */
    occupantKind?: OccupantKind;
    /** One-off env for this launch only (`rig up --env`); wins over the spec's env and is not saved. */
    env?: SeatEnv;
    /** The seat's resolved plugin locations (what the profile resolver selected for it, or a snapshot saved). A Claude
     *  seat whose selection includes the vendored openrig-core plugin loads it. Without this the node's saved startup
     *  context is read. */
    pluginPaths?: readonly string[];
    /** Admission lane for this launch. Operator-initiated launches pass
     *  "interactive"; batch/restore launches keep the background default. */
    lane?: LaunchLane;
}
interface NodeLauncherDeps {
    db: Database.Database;
    rigRepo: RigRepository;
    sessionRegistry: SessionRegistry;
    eventBus: EventBus;
    tmuxAdapter: TmuxAdapter;
    transcriptStore?: TranscriptStore;
    sessionEnv?: Record<string, string | undefined>;
    /** Extra launch env for one runtime only (OMP's provider keys), merged over
     *  sessionEnv so other runtimes' seats never receive it. */
    runtimeSessionEnv?: Record<string, Record<string, string | undefined>>;
    /** Where the daemon vendors its plugins; default is `plugins` under the OpenRig home (tests). */
    pluginsDir?: string;
    /** Default silence window (seconds). Currently used only as the
     *  SeatActivityService global default (3s). Per-seat override via
     *  LaunchOpts is currently inert. */
    defaultSilenceWindowSeconds?: number;
    /**
     * OPR.0.4.6.02 S1 — the SHARED tmux option-defaults applier (mouse/status
     * session-scope + set-clipboard/copy-command server-scope), applied to the
     * just-created session at launch. Injected from startup so the same
     * instance (and its once-per-daemon server-defaults memo) is shared with
     * SuccessorSessionLauncher. When omitted (most unit tests), the launch path
     * skips option application entirely.
     */
    tmuxOptionDefaults?: TmuxOptionDefaultsApplier;
    /**
     * Optional default-off launch admission gate. When absent, launches behave
     * exactly as before (no queue, no counters). When present and disabled it
     * admits immediately and reports `not_enforced`.
     */
    launchAdmission?: LaunchAdmission;
    /**
     * Optional default-off toolchain concurrency projection. Returns the env
     * additions for one seat; `{}` (or absent) leaves the launch env exactly as
     * before. Existing sources win on merge: this map is applied first, so the
     * daemon env, the runtime env, the seat spec and `rig up --env` override it.
     */
    toolchainEnvironment?: () => Record<string, string>;
    /**
     * Optional default-off provider/model seat-start limiter. Absent means
     * launches behave exactly as before (no query, no queue, no counters).
     */
    providerRateLimit?: ProviderRateLimiter;
}
export declare class NodeLauncher {
    readonly db: Database.Database;
    private rigRepo;
    private sessionRegistry;
    private eventBus;
    private tmuxAdapter;
    private transcriptStore;
    private sessionEnv;
    private runtimeSessionEnv;
    private pluginsDir;
    private defaultSilenceWindowSeconds;
    private tmuxOptionDefaults;
    private launchAdmission;
    private toolchainEnvironment;
    private providerRateLimit;
    constructor(deps: NodeLauncherDeps);
    launchNode(rigId: string, logicalId: string, opts?: LaunchOpts): Promise<LaunchResult>;
    /**
     * Put each one-off name back to what the session would have had without it: `baseline` has the
     * value the spec or OpenRig set for it, and a name with none is unset (the server's own value, if
     * it has one, is what a later pane gets). `TMUX` and `TMUX_PANE` belong to tmux and are left alone.
     * Returns the name that could not be restored, or undefined when all were. The message built from
     * it carries no value: tmux errors repeat the command line.
     */
    private dropOneOffFromSession;
}
export {};
//# sourceMappingURL=node-launcher.d.ts.map