export type SourceState = "draft" | "file_preview" | "library_item";
export interface SpecGraphData {
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
}
export interface RigSpecServicesReview {
    kind: "compose";
    composeFile: string;
    projectName?: string;
    downPolicy?: string;
    waitFor: Array<{
        service?: string;
        url?: string;
        tcp?: string;
        condition?: "healthy";
    }>;
    surfaces?: {
        urls?: Array<{
            name: string;
            url: string;
        }>;
        commands?: Array<{
            name: string;
            command: string;
        }>;
    };
    composePreview?: {
        services: Array<{
            name: string;
            image?: string;
        }>;
    };
}
interface RigSpecReviewBase {
    sourceState: SourceState;
    kind: "rig";
    name: string;
    version: string;
    summary?: string;
    cultureFile?: string;
    services?: RigSpecServicesReview;
    graph: SpecGraphData;
    raw: string;
}
export interface PodAwareRigSpecReview extends RigSpecReviewBase {
    format: "pod_aware";
    pods: Array<{
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
    edges: Array<{
        from: string;
        to: string;
        kind: string;
    }>;
}
export interface LegacyRigSpecReview extends RigSpecReviewBase {
    format: "legacy";
    nodes: Array<{
        id: string;
        runtime: string;
        role?: string;
        model?: string;
    }>;
    edges: Array<{
        from: string;
        to: string;
        kind: string;
    }>;
}
export type RigSpecReview = PodAwareRigSpecReview | LegacyRigSpecReview;
export interface AgentSpecReview {
    sourceState: SourceState;
    kind: "agent";
    name: string;
    version: string;
    description?: string;
    profiles: Array<{
        name: string;
        description?: string;
    }>;
    resources: {
        skills: string[];
        guidance: string[];
        plugins: string[];
        subagents: string[];
    };
    startup: {
        files: Array<{
            path: string;
            required: boolean;
        }>;
        actions: Array<{
            type: string;
            value: string;
        }>;
    };
    raw: string;
}
export declare class SpecReviewError extends Error {
    readonly errors: string[];
    constructor(errors: string[]);
}
export declare class SpecReviewService {
    reviewRigSpec(yaml: string, sourceState: SourceState): RigSpecReview;
    private reviewPodAwareRigSpec;
    private reviewLegacyRigSpec;
    reviewAgentSpec(yaml: string, sourceState: SourceState): AgentSpecReview;
}
export {};
//# sourceMappingURL=spec-review-service.d.ts.map