import type { RigSpec } from "./types.js";
/**
 * Build B — spec-vs-live topology conformance.
 *
 * A rig spec is consumed as AUTHORITATIVE by everything that recreates or describes a rig
 * (instantiation, `rig validate`, bundle export, pod-bundle vendoring) and is MAINTAINED by nothing
 * that mutates one. `rig expand` adds a pod to a running rig through the daemon; no code path writes
 * the rigRoot spec back. So drift is not an accident to be prevented here — with no writer it is
 * guaranteed — and this module does not try to prevent it.
 *
 * What it does is make the drift SAYABLE at the two moments it causes damage: a bundle export, which
 * copies the spec verbatim and would otherwise ship a smaller rig than the one running, in silence;
 * and an explicit conformance check, which is how a later spec write-back gets VERIFIED instead of
 * eyeballed.
 *
 * REPORTING ONLY. Nothing here mutates a spec or blocks an export.
 */
export interface Topology {
    /** Pod ids, e.g. `orch`. */
    pods: string[];
    /** Fully-qualified seat ids, e.g. `orch.lead`. */
    seats: string[];
}
export interface ConformanceResult {
    conforms: boolean;
    spec: {
        pods: number;
        seats: number;
    };
    live: {
        pods: number;
        seats: number;
    };
    /** Running but undeclared — what a bundle export would silently DROP. */
    podsMissingFromSpec: string[];
    seatsMissingFromSpec: string[];
    /** Declared but not running — what a re-instantiation would try to bring up. */
    podsMissingFromLive: string[];
    seatsMissingFromLive: string[];
    /**
     * A single actionable line naming the REAL delta, or null when the topologies agree.
     *
     * Null-on-conformance is the contract, not an implementation detail. A check that warns every
     * time trains its reader to skim, and the one export that matters then reads like the ninety-six
     * before it. Callers may print this whenever it is non-null and print nothing when it is not.
     */
    message: string | null;
}
export declare function compareSpecToLive(spec: Topology, live: Topology): ConformanceResult;
/** Pods and seats as the SPEC declares them. */
export declare function topologyFromRigSpec(spec: Pick<RigSpec, "pods">): Topology;
/**
 * Pods and seats as the DAEMON is actually running them, derived from node logical ids
 * (`<pod>.<member>`). Malformed or empty ids are skipped rather than guessed at — an id we cannot
 * parse is not evidence of a pod.
 */
export declare function topologyFromLiveLogicalIds(logicalIds: readonly (string | null | undefined)[]): Topology;
/**
 * Seats as a LEGACY (v1) spec declares them — a flat `nodes:` list with no pods.
 *
 * A v1 spec exports through the same create endpoint and produces the same confidently-wrong
 * artifact, so it needs the same comparison. It does not need a second comparator: a legacy rig is
 * just a topology with no pod level, and `compareSpecToLive` already handles an empty pod list.
 */
export declare function topologyFromLegacyRigSpec(spec: {
    nodes?: ReadonlyArray<{
        id?: unknown;
    }>;
}): Topology;
/**
 * Seats as the daemon is running them, read FLAT — the legacy counterpart to
 * `topologyFromLiveLogicalIds`.
 *
 * For a legacy rig a node's `logical_id` IS the spec's `node.id`; there is no `<pod>.<member>` to
 * split. Reusing the pod-aware reader here would parse every flat id as malformed and report an
 * empty live rig, which reads as "nothing is running" — a false absence, and the most dangerous
 * possible answer for a guard whose whole job is noticing what would be dropped.
 */
export declare function topologyFromLiveNodeIds(logicalIds: readonly (string | null | undefined)[]): Topology;
/** The one-line export banner. Null when there is nothing to say. */
export declare function bundleExportWarning(result: ConformanceResult): string | null;
//# sourceMappingURL=spec-live-conformance.d.ts.map