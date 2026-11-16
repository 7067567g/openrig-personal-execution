import { Command } from "commander";
import type { StatusDeps } from "./status.js";
/**
 * `rig project` — coordination primitive L2 (classifier) commands (PL-004 Phase B).
 *
 * Coordination uses `/api/projects`; optional experiment configuration/provider
 * processing is local to the invoking occupant.
 *
 * Per PRD § L2: classifier judgment stays with the agent; daemon enforces
 * the lease + idempotency + reclaim contract.
 */
export interface ProjectDeps extends StatusDeps {
    workerRead?: (file: string) => string;
    experimentEnv?: NodeJS.ProcessEnv;
    experimentFetch?: typeof fetch;
}
export declare function projectCommand(depsOverride?: ProjectDeps): Command;
//# sourceMappingURL=project.d.ts.map