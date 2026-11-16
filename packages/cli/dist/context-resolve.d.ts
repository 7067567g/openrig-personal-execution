import type { DaemonClient } from "./client.js";
export interface ResolvedContext {
    ref: string;
    text: string;
    bytes: number;
}
/** Advisory size threshold: a resolved context larger than this is "walk-sized"
 *  — better paced with `rig walk` than blasted into a pane as one paste (§4). */
export declare const WALK_SIZED_THRESHOLD_BYTES = 8192;
export declare function resolveContextRef(client: DaemonClient, ref: string): Promise<ResolvedContext>;
/** The §4 size warn: when a resolved --context is walk-sized, advise pacing it
 *  with `rig walk` instead of one paste. Advisory — never blocks the send. */
export declare function walkSizedWarning(resolved: ResolvedContext, seat?: string): string | null;
//# sourceMappingURL=context-resolve.d.ts.map