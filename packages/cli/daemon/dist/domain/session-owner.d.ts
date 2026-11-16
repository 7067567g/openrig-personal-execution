import type Database from "better-sqlite3";
export interface SessionOwnerRow {
    node_id: string;
    logical_id: string;
    rig_name: string;
}
/**
 * The OTHER managed node that currently owns a tmux session name, if any: a node whose binding names
 * it, or a node with a live (not superseded, detached or exited) session row under it. A session name
 * can be shared across rigs, for example by an archived duplicate of a live rig, so the name alone
 * never proves which node a session belongs to. `ignoreArchived` skips owners in archived rigs: an
 * archived rig keeps its bindings, so its node would otherwise claim the live seat's session.
 * `excludeNodeIds` skips further nodes, such as the rest of a group being removed together; it is applied
 * in both lookups before the first match is taken, so an excluded node can't hide another owner.
 */
export declare function findOtherSessionOwner(db: Database.Database, tmuxSession: string, nodeId: string, opts?: {
    ignoreArchived?: boolean;
    excludeNodeIds?: readonly string[];
}): SessionOwnerRow | null;
//# sourceMappingURL=session-owner.d.ts.map