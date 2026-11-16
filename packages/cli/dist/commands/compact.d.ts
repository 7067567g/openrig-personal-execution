import { Command } from "commander";
import { DaemonClient } from "../client.js";
import { type LifecycleDeps } from "../daemon-lifecycle.js";
export interface CompactDeps {
    lifecycleDeps: LifecycleDeps;
    clientFactory: (url: string) => DaemonClient;
}
/**
 * OPR.0.4.3.14 — `rig compact <session>`: manually run the guided compaction
 * lifecycle (prep → /compact → restore → audit) for one Claude seat, on demand,
 * independent of the auto threshold. Distinct from the read-only `rig
 * compact-plan` triage command.
 */
export declare function compactCommand(depsOverride?: CompactDeps): Command;
//# sourceMappingURL=compact.d.ts.map