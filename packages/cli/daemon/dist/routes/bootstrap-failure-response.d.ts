import type { BootstrapResult } from "../domain/bootstrap-orchestrator.js";
/** Present the same failed bootstrap outcome consistently on both entry routes.
 * Plan keeps its first-failed-stage response; apply promotes known refusal codes.
 * This does not decide whether bootstrap may proceed.
 */
export declare function bootstrapFailureResponse(result: BootstrapResult, mode: "plan" | "apply"): {
    body: BootstrapResult & {
        code?: string;
        error?: string;
    };
    status: 400 | 409 | 500;
};
//# sourceMappingURL=bootstrap-failure-response.d.ts.map