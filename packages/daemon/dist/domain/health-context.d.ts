import type { HealthRecord } from "./health-projection.js";
import type { AuthorityReference } from "./health-diagnosis.js";
import type { HealthCheckpointSource } from "./health-checkpoints.js";
/** Local evidence files only. Unsupported addresses retain unavailable truth.
 * Reuse the file surface's realpath resolver; callers choose whether to embed bytes. */
export declare function readHealthArtifact(workspace: string, path: string, maxBytes?: number, embed?: boolean): AuthorityReference;
/** Reuse authored context selections, including project planning before a mission exists.
 * No filename guesses, recursive link following, or executable workflow adoption. */
export declare function healthSelectedContext(workspace: string, missionRoot?: string): AuthorityReference[];
export declare function healthAuthority(workspace: string, checkpoints: HealthCheckpointSource, record: HealthRecord): AuthorityReference[];
/** Connector-specific readiness lives behind the transport-neutral diagnosis port.
 * No notification is posted here; the existing gateway owns posting and receipts. */
export declare function healthHumanReadiness(home: string, address: string, gatewayActive: boolean): Promise<{
    ready: boolean;
    reason: string;
}>;
//# sourceMappingURL=health-context.d.ts.map