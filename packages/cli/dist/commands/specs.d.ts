import { Command } from "commander";
import { DaemonClient } from "../client.js";
import type { StatusDeps } from "./status.js";
interface LibraryEntry {
    id: string;
    kind: "rig" | "agent" | "workflow";
    name: string;
    version: string;
    sourceType: string;
    sourcePath: string;
    relativePath: string;
    updatedAt: string;
    summary?: string;
}
/**
 * Shared name resolution for library specs.
 * Returns the matching entry, or throws with guidance on ambiguity/not-found.
 */
export declare function resolveLibrarySpec(client: DaemonClient, nameOrId: string, opts?: {
    kind?: LibraryEntry["kind"];
}): Promise<LibraryEntry>;
export declare function specsCommand(depsOverride?: StatusDeps): Command;
export {};
//# sourceMappingURL=specs.d.ts.map