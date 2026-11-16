import { Command } from "commander";
import type { StatusDeps } from "./status.js";
export interface WalkDeps extends StatusDeps {
    /** Test seam for the inter-piece pacing delay. */
    sleep?: (ms: number) => Promise<void>;
    /** Test seams for local-file resolution. */
    fileExists?: (path: string) => boolean;
    readFile?: (path: string) => string;
}
/** Parse a walk duration with an explicit unit: `10s` or `500ms`. Returns
 *  null on a malformed value; the default when undefined. */
export declare function parsePaceMs(value: string | undefined): number | null;
export interface WalkPiece {
    /** A human label for the piece (file path or pack member path). */
    label: string;
    content: string;
}
export declare function walkCommand(depsOverride?: WalkDeps): Command;
//# sourceMappingURL=walk.d.ts.map