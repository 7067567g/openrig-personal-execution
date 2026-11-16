import { Command } from "commander";
import { DaemonClient } from "../client.js";
import type { StatusDeps } from "./status.js";
import { loadHostRegistry } from "../host-registry.js";
import { runCrossHostCommand, type RunCrossHostCommandOpts } from "../cross-host-executor.js";
interface WhoamiCliOptions {
    nodeId?: string;
    session?: string;
    host?: string;
    allHosts?: boolean;
    hosts?: string;
    json?: boolean;
    full?: boolean;
    verbose?: boolean;
    allPeers?: boolean;
}
export interface WhoamiDeps extends StatusDeps {
    /** Cross-host hooks; mirrors PsDeps/SendDeps shape. Tests inject mocks. */
    hostRegistryLoader?: () => ReturnType<typeof loadHostRegistry>;
    crossHostRun?: (host: Parameters<typeof runCrossHostCommand>[0], argv: readonly string[], opts?: RunCrossHostCommandOpts) => ReturnType<typeof runCrossHostCommand>;
}
export interface BoundedPeers {
    peers: unknown[];
    omitted: number;
    /** The daemon's own note when every peer fits; otherwise what was left out and how to list it. */
    note: unknown;
}
/**
 * Slice 15 (OPR.0.7.0.15) P5 — with `output.compact` on, compact `--json` lists at most `bound` peers so the
 * every-boot call stays small as a rig grows. Edge peers (either direction) come first, then peers in the
 * seat's own pod, then the rest, each in the daemon's roster order. Nothing is silently missing: the note
 * says how many were left out and the exact command that lists them all, and `edges` stays complete. When
 * every peer fits, the roster and the daemon's note pass through unchanged, so a small rig pays only for
 * `peersOmitted: 0`.
 */
export declare function boundPeers(data: Record<string, unknown>, bound: number, allPeersCommand: string): BoundedPeers;
type TmuxExecFn = (cmd: string) => string;
/**
 * Resolve the current session identity using the approved resolution chain:
 * 1. --node-id flag
 * 2. --session flag
 * 3. OPENRIG_NODE_ID env
 * 4. OPENRIG_SESSION_NAME env
 * 5. TMUX_PANE → @rigged_node_id tmux metadata
 * 6. TMUX_PANE → @rigged_session_name tmux metadata
 * 7. TMUX_PANE → tmux display-message (raw session name)
 * 8. fail
 */
export declare function resolveIdentitySource(opts: {
    nodeId?: string;
    session?: string;
}, tmuxExec?: TmuxExecFn): {
    nodeId?: string;
    sessionName?: string;
} | null;
/** Enrich an identity miss using only the client that returned it; never discover or retry another daemon. */
export declare function identityRoutingHint(client: DaemonClient): Promise<string>;
export declare function whoamiCommand(depsOverride?: WhoamiDeps): Command;
/**
 * Slice 15 (OPR.0.7.0.15) P5 over SSH `--host`: the remote bounds its peer list, and its note names the full-list
 * command as run there. Copied at the origin, that command would query this host instead, so here it gains the
 * host (and the identity the remote resolved, when none was asked for). Only that exact command, inside the
 * top-level `peersNote` value itself, is replaced: the note must appear once, serialized exactly as JSON.stringify
 * writes it, and the result must parse to the same object with only that note changed. Anything else (unbounded,
 * older, malformed, differently encoded or ambiguous output, or a note in another form) passes through byte for
 * byte.
 */
export declare function withOriginPeersCommand(stdout: string, hostId: string, opts: WhoamiCliOptions): string;
export {};
//# sourceMappingURL=whoami.d.ts.map