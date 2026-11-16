import type { DaemonClient } from "./client.js";
/**
 * Outcome of resolving a rig handle (name OR id) to a concrete id, shared by
 * `rig down` and `rig add`. A mutation only ever runs on a `resolved` id or a
 * `passthrough` handle; callers halt on `ambiguous` (and `rig down` also on
 * `not_found`) BEFORE any POST.
 */
export type HandleResolution = {
    kind: "resolved";
    id: string;
    byName: boolean;
} | {
    kind: "ambiguous";
    name: string;
    ids: string[];
} | {
    kind: "not_found";
    handle: string;
} | {
    kind: "passthrough";
    handle: string;
};
/**
 * Resolve a rig handle (rig name OR id) to a concrete rig id, mirroring the
 * `/api/rigs/summary` path `rig up` uses. Resolution is a PRE-STEP: each
 * command's existing request + guards downstream are unchanged; this only maps
 * the handle to an id.
 *
 * Safety order (mutating ops):
 *  1. id-exact-match FIRST, across ALL rigs incl. archived - an id is unique, so
 *     it is never ambiguous, and an archived rig's id must still reach the
 *     canonical id path (also when an active rig is NAMED like that id).
 *  2. else name-filter over ACTIVE (non-archived) rigs only:
 *     - exactly 1 active match -> resolve to that id;
 *     - >1 active matches      -> AMBIGUOUS: halt, never guess;
 *     - 0 active matches       -> NOT_FOUND.
 *
 * `/api/rigs/summary` defaults to ACTIVE-only and exposes `archivedAt`; we fetch
 * with `includeArchived=true` so an archived id still id-matches, then filter
 * names to active. So an active+archived same-name pair is NOT ambiguous (only
 * the active candidate counts), and an archived-only name does not resolve by
 * name (use the id, or the archive path).
 */
export declare function resolveRigHandle(client: DaemonClient, handle: string): Promise<HandleResolution>;
//# sourceMappingURL=rig-handle.d.ts.map