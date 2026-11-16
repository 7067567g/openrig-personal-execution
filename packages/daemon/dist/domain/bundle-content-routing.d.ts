import { type RouteSkillsResult } from "./bundle-skills-router.js";
import { type RoutePluginsResult } from "./bundle-plugins-router.js";
import { type RouteWorkflowSpecsResult } from "./bundle-workflow-specs-router.js";
import { type RouteContextPacksResult } from "./bundle-context-packs-router.js";
import { type RouteAgentImagesResult } from "./bundle-agent-images-router.js";
import { type ProjectRegistrationResult } from "./workspace/project-registration.js";
/**
 * Routes the primitives a .rigbundle declares (skills, plugins, workflow
 * specs, context packs, agent images) into the operator's libraries.
 *
 * Bootstrap runs this in the pre-launch hook, after the rig record exists and
 * before any seat launches, so a seat's first turn can already see what the
 * bundle carried. It never throws: each kind is routed independently and a
 * failure is recorded in `routingFailures` rather than hidden.
 */
export type BundleContentKind = "bundle" | "skills" | "plugins" | "workflowSpecs" | "contextPacks" | "agentImages" | "project";
export interface BundleContentRouting {
    skillsRouting?: RouteSkillsResult;
    pluginsRouting?: RoutePluginsResult;
    workflowSpecsRouting?: RouteWorkflowSpecsResult;
    contextPacksRouting?: RouteContextPacksResult;
    agentImagesRouting?: RouteAgentImagesResult;
    /** The bundle's project in the workspace catalog, and this rig's association with it. */
    projectRegistration?: ProjectRegistrationResult;
    routingFailures?: Array<{
        kind: BundleContentKind;
        error: string;
    }>;
}
export interface BundleContentRoutingOptions {
    /** Called after context packs were routed, so the live library can rescan them. Returns the scan's per-pack errors. */
    onContextPacksRouted?: () => {
        errors?: Array<{
            source: string;
            error: string;
        }>;
    } | void;
}
/** The message of anything thrown or rejected, including values that are not Errors (null, undefined, strings). */
export declare function thrownMessage(err: unknown): string;
/** One human-readable warning per routing failure, for the result's warnings list. */
export declare function routingFailureWarnings(routing: BundleContentRouting | undefined): string[];
/**
 * Extract the bundle once through the banked unpack trust boundary, then route
 * every declared kind. A kind the bundle does not declare is left out of the
 * result.
 */
export declare function routeBundleContents(bundlePath: string, opts?: BundleContentRoutingOptions): Promise<BundleContentRouting>;
//# sourceMappingURL=bundle-content-routing.d.ts.map