export interface DemoRigSummaryLike {
    rigId: string;
    name: string;
    status?: string;
}
export interface DemoNodeLike {
    rigId: string;
}
export declare function selectCurrentRigSummary<T extends DemoRigSummaryLike>(rigs: T[], rigName: string): T | null;
export declare function filterNodesForRigId<T extends DemoNodeLike>(nodes: T[], rigId: string): T[];
//# sourceMappingURL=demo-rig-selector.d.ts.map