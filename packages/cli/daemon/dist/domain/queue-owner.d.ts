import type Database from "better-sqlite3";
/** The durable session→node binding (the session-registry precedent: latest sessions row
 *  for the canonical name). Canonical session names (dash form, `review-r2@rig`) and node
 *  logical ids (dotted form, `review.r2`) are INDEPENDENT identities — the live fleet has
 *  zero cases where they match — so resolution NEVER string-converts between them. */
export declare function resolveSessionNodeId(db: Database.Database, session: string): string | null;
/** Default orchestrator derivation: the destination's BOUND node → the source of its
 *  delegates_to edge → that parent node's CURRENT canonical session binding. A session
 *  outside the recorded topology, or a parent with no session binding, resolves to null
 *  (there is no orchestrator session to wake — never synthesize one). */
export declare function defaultResolveOrchestrator(db: Database.Database, session: string): string | null;
//# sourceMappingURL=queue-owner.d.ts.map