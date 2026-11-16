import { type ContentLine } from "../detail.js";
import type { ExecutionViewSnap } from "./execution-model.js";
export declare function workflowOverview(execution: ExecutionViewSnap, width: number): ContentLine[];
/** All claims are served state or attributed records. No receipt is adjudicated here. */
export declare function workflowDetail(execution: ExecutionViewSnap, key: string, width: number, timeZone?: string): ContentLine[] | null;
//# sourceMappingURL=workflow-model.d.ts.map