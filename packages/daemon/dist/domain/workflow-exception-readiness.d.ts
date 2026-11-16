import type Database from "better-sqlite3";
import type { WorkflowSpec } from "./workflow-types.js";
import type { LifecycleGraphSource } from "./project-lifecycle-compiler.js";
import { type ExceptionRouteInput } from "./workflow-exception-router.js";
/** The configuration owner, not a generated cached spec or every source mirror. */
export declare function exceptionConfigurationSource(sourcePath: string, graph?: LifecycleGraphSource): string;
export interface ExceptionReadiness {
    scope: "future-occurrences";
    posture: "advisory";
    selection: {
        state: "missing" | "selected" | "undeclared";
        role: string | null;
        source: string;
        entryRole: string | null;
    };
    routes: Array<{
        exceptionClass: string;
        state: string;
        roleResolution: string;
        destinationSession: string | null;
        position: string | null;
        resolvedVia: string | null;
        identity: string;
        message: string;
    }>;
    nextAction: string;
}
/** Read the same lazy resolver as detection. Failed reads stay unavailable;
 * inspection never writes, routes work, or imposes an admission gate. */
export declare function inspectExceptionReadiness(input: {
    db: Database.Database;
    spec: WorkflowSpec;
    source: string;
    boundRig?: string | null;
    hostDefault: () => ExceptionRouteInput["hostDialDefault"];
    humanFallbackSeat?: ExceptionRouteInput["humanFallbackSeat"];
    instanceId?: string;
}): ExceptionReadiness;
//# sourceMappingURL=workflow-exception-readiness.d.ts.map