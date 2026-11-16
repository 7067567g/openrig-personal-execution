import { Command } from "commander";
import { type LifecycleDeps } from "../daemon-lifecycle.js";
import type { StatusDeps } from "./status.js";
export declare function sourceLooksLikeTopology(source: string): boolean;
export declare const HOST_TOPOLOGY_REJECTION = "rig up --host cannot take a topology source: per-entry 'host:' in the manifest is the ONLY placement mechanism for topologies (two placement mechanisms must not coexist). Put 'host: <id>' on the entries you want placed remotely and run 'rig up <topology>' without --host.";
export declare function upCommand(depsOverride?: StatusDeps & {
    lifecycleDeps?: LifecycleDeps;
    preflightExec?: (cmd: string) => Promise<string>;
    /** OPR.0.3.4.2 — injectable [y/N] prompt for the awaiting-decision ASK
     *  (tests drive it; default = readline on stdin, offered on TTY only). */
    promptYesNo?: (question: string) => Promise<boolean>;
}): Command;
/** Render a failed remote `rig up` response without stringifying an unknown
 *  body as `[object Object]`. JSON mode keeps the complete RemoteOpResult;
 *  human mode shows known daemon guidance and safely falls back for older or
 *  partial error bodies. */
export declare function formatRemoteUpFailure(hostId: string, result: {
    error?: string;
    data?: unknown;
}): string[];
//# sourceMappingURL=up.d.ts.map