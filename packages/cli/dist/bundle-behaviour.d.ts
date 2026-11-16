import type { BundleBehaviour } from "@openrig-local/daemon/bundle-behaviour";
export declare function formatBundleBehaviour(view: BundleBehaviour): string[];
interface InspectionResponse {
    status: number;
    data: Record<string, unknown>;
}
/** Diagnostic only: this helper must not change an install/up request, prompt or exit code. */
export declare function showBundleBehaviourBeforeAction(inspect: () => Promise<InspectionResponse>, output?: (line: string) => void): Promise<BundleBehaviour | undefined>;
export {};
//# sourceMappingURL=bundle-behaviour.d.ts.map