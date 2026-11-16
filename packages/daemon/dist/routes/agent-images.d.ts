import { Hono } from "hono";
export interface AgentImageRoutesDeps {
    /** Spec-library roots scanned by the evidence guard. v0 includes
     *  the canonical user spec directory + workspace specs root. */
    specRoots: () => readonly string[];
}
export declare function agentImagesRoutes(deps: AgentImageRoutesDeps): Hono;
//# sourceMappingURL=agent-images.d.ts.map