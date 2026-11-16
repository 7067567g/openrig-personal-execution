export declare const SUPPORTED_NODE_MAJORS: readonly [22, 24];
export type NodeSupportKind = "supported" | "too_old" | "odd" | "untested";
export interface NodeSupport {
    major: number;
    kind: NodeSupportKind;
    /** One-line statement, present for every kind except "supported". */
    message?: string;
    reason?: string;
    fix?: string;
}
export declare function classifyNodeVersion(version: string): NodeSupport;
//# sourceMappingURL=node-support.d.ts.map