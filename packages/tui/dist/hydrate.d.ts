import { DaemonClient } from "./daemon-client.js";
import type { FleetSnapshot, ViewState } from "./types.js";
interface AgentSpecReviewRead {
    sourceState?: "draft" | "file_preview" | "library_item";
    kind: "agent";
    description?: string;
    profiles?: Array<{
        name: string;
    }>;
    resources?: {
        skills?: string[];
        guidance?: string[];
        plugins?: string[];
        subagents?: string[];
    };
    startup?: {
        files?: Array<{
            path: string;
            required: boolean;
        }>;
    };
    raw?: string;
}
interface RigSpecReviewRead {
    sourceState?: "draft" | "file_preview" | "library_item";
    kind: "rig";
    format?: "pod_aware" | "legacy";
    pods?: Array<{
        id: string;
        namespace?: string;
        label?: string;
        members: Array<{
            id: string;
            agentRef: string;
            runtime: string;
            profile?: string;
        }>;
        edges: Array<{
            from: string;
            to: string;
            kind: string;
        }>;
    }>;
    nodes?: Array<{
        id: string;
        runtime: string;
        role?: string;
        model?: string;
    }>;
    edges?: Array<{
        from: string;
        to: string;
        kind: string;
    }>;
    graph?: {
        nodes: Array<{
            id: string;
            label: string;
            pod?: string;
            runtime: string;
            kind: "agent" | "infrastructure";
        }>;
        edges: Array<{
            source: string;
            target: string;
            kind: string;
        }>;
    };
    raw?: string;
}
type SpecLibraryReviewRead = AgentSpecReviewRead | RigSpecReviewRead;
/** Cross-cycle memo for spec-detail reviews, keyed by `${id}@${updatedAt}` —
 * avoids re-reading every spec every refresh; the key rolls when the library
 * entry's updatedAt changes. Owned by the caller (instance-scoped, no module state). */
export type SpecReviewCache = Map<string, SpecLibraryReviewRead>;
export type HydrateViewContext = Pick<ViewState, "project" | "section" | "viewTab" | "drill" | "file" | "externalUrl" | "terminalView" | "attentionOpen" | "pendingDrill">;
export declare function hydrateSnapshot(client: DaemonClient, reviewCache?: SpecReviewCache, executionMission?: string | null, sliceDetailName?: string | null, currentRigName?: string | null, viewContext?: HydrateViewContext): Promise<FleetSnapshot>;
export {};
//# sourceMappingURL=hydrate.d.ts.map